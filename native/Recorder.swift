// Local, explicitly started audio-only ScreenCaptureKit helper. No network or ASR.
// Build with native/build-helper.sh. --self-test never touches capture/permission APIs.
import Foundation
import Darwin
import AVFoundation
import AudioToolbox
import CoreMedia
import ScreenCaptureKit

private let outputRate = 16_000.0
private let bytesPerFrame: Int64 = 2
private let hostClock = CMClockGetHostTimeClock()
private func hostNow() -> Double { CMTimeGetSeconds(CMClockGetTime(hostClock)) }

private struct RecorderError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}
private func posixError(_ operation: String) -> RecorderError {
    RecorderError("\(operation): \(String(cString: strerror(errno)))")
}

@discardableResult private func emit(_ object: [String: Any]) -> Bool {
    guard var data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return false }
    data.append(10)
    return (try? writeAll(STDOUT_FILENO, data)) != nil
}
private func writeAll(_ fd: Int32, _ data: Data, at offset: Int64? = nil) throws {
    try data.withUnsafeBytes { raw in
        guard let base = raw.baseAddress else { return }
        var done = 0
        while done < raw.count {
            let n: Int
            if let offset = offset {
                n = Darwin.pwrite(fd, base.advanced(by: done), raw.count - done, off_t(offset + Int64(done)))
            } else {
                n = Darwin.write(fd, base.advanced(by: done), raw.count - done)
            }
            if n < 0 && errno == EINTR { continue }
            guard n > 0 else { throw posixError("write") }
            done += n
        }
    }
}
private extension Data {
    mutating func appendLE<T: FixedWidthInteger>(_ value: T) {
        var value = value.littleEndian
        Swift.withUnsafeBytes(of: &value) { append(contentsOf: $0) }
    }
}

private enum Mode: String {
    case mic, system, both
    var tracks: [String] {
        switch self { case .mic: return ["microphone"]; case .system: return ["system"]; case .both: return ["microphone", "system"] }
    }
}
private struct Options {
    let output: String
    let mode: Mode
    let selfTest: Bool
    static func parse(_ args: [String]) throws -> Options {
        var output: String?
        var mode: Mode?
        var selfTest = false
        var index = 0
        while index < args.count {
            switch args[index] {
            case "--self-test":
                guard !selfTest else { throw RecorderError("Duplicate --self-test") }
                selfTest = true
            case "--output":
                index += 1
                guard index < args.count, output == nil else { throw RecorderError("Expected one --output directory") }
                output = args[index]
            case "--mode":
                index += 1
                guard index < args.count, mode == nil, let parsed = Mode(rawValue: args[index]) else {
                    throw RecorderError("--mode must be mic, system or both")
                }
                mode = parsed
            default:
                throw RecorderError("Usage: recorder --output <absolute-empty-owned-dir> --mode mic|system|both; or --self-test --output <dir>")
            }
            index += 1
        }
        guard let output = output, output.hasPrefix("/"), !output.contains("\0") else {
            throw RecorderError("--output must name an existing absolute empty directory owned by this user")
        }
        guard selfTest || mode != nil else { throw RecorderError("--mode is required for recording") }
        guard !selfTest || mode == nil || mode == .both else { throw RecorderError("--self-test exercises both tracks") }
        return Options(output: output, mode: mode ?? .both, selfTest: selfTest)
    }
}

// Pin the checked directory descriptor, then create only fixed filenames via openat.
// Never overwrite a recording, follow a final symlink, delete files, or create parent paths.
private final class OutputDirectory {
    let fd: Int32
    let path: String
    init(_ path: String) throws {
        let checkedPath = URL(fileURLWithPath: path).standardizedFileURL.path
        self.path = checkedPath
        let fd = Darwin.open(checkedPath, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { throw posixError("open output directory") }
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_uid == getuid(), info.st_mode & mode_t(S_IFMT) == mode_t(S_IFDIR) else {
            Darwin.close(fd)
            throw RecorderError("Output directory must be owned by this user and not a symlink")
        }
        let scanFD = dup(fd)
        guard scanFD >= 0, let directory = fdopendir(scanFD) else {
            if scanFD >= 0 { Darwin.close(scanFD) }
            Darwin.close(fd)
            throw posixError("inspect output directory")
        }
        var empty = true
        while let entry = readdir(directory) {
            let name = withUnsafePointer(to: &entry.pointee.d_name) {
                $0.withMemoryRebound(to: CChar.self, capacity: Int(MAXNAMLEN) + 1) { String(cString: $0) }
            }
            if name != "." && name != ".." { empty = false; break }
        }
        closedir(directory)
        guard empty else {
            Darwin.close(fd)
            throw RecorderError("Output directory must be empty; existing files were not changed")
        }
        self.fd = fd
    }
    deinit { Darwin.close(fd) }
}

// Exactly 44-byte RIFF/PCM header + little-endian signed16 mono payload.
// pwrite permits timestamp-positioned samples to replace previously padded silence.
private final class PCMWriter {
    private var fd: Int32
    private(set) var frames: Int64 = 0
    private(set) var peak = 0.0
    private(set) var nonSilentFrames: Int64 = 0
    let filename: String
    var bytes: Int64 { frames * bytesPerFrame }
    init(directory: OutputDirectory, track: String) throws {
        filename = "\(track).wav"
        fd = openat(directory.fd, filename, O_CREAT | O_EXCL | O_RDWR | O_NOFOLLOW | O_CLOEXEC, mode_t(0o600))
        guard fd >= 0 else { throw posixError("create \(filename)") }
        try checkpoint()
    }
    deinit { if fd >= 0 { Darwin.close(fd) } }
    static func header(_ bytes: Int64) -> Data {
        var data = Data("RIFF".utf8)
        data.appendLE(UInt32(36 + bytes))
        data.append(contentsOf: "WAVEfmt ".utf8)
        data.appendLE(UInt32(16))
        data.appendLE(UInt16(1)) // PCM, not float/extensible
        data.appendLE(UInt16(1))
        data.appendLE(UInt32(outputRate))
        data.appendLE(UInt32(outputRate * 2))
        data.appendLE(UInt16(2))
        data.appendLE(UInt16(16))
        data.append(contentsOf: "data".utf8)
        data.appendLE(UInt32(bytes))
        return data
    }
    private func checkSize(_ target: Int64) throws {
        guard target >= 0, target <= (Int64(UInt32.max) - 36) / bytesPerFrame else {
            throw RecorderError("PCM WAV reached its RIFF 4 GiB limit; stop and start a new recording")
        }
    }
    func pad(to target: Int64) throws {
        try checkSize(target)
        let zeroes = Data(count: 32_768)
        while frames < target {
            let count = Int(min(target - frames, Int64(zeroes.count) / bytesPerFrame))
            try writeAll(fd, zeroes.prefix(count * Int(bytesPerFrame)), at: 44 + bytes)
            frames += Int64(count)
        }
    }
    func write(_ pcm: Data, at startFrame: Int64) throws {
        guard fd >= 0, startFrame >= 0, pcm.count % 2 == 0 else { throw RecorderError("Invalid PCM write") }
        let count = Int64(pcm.count / 2)
        try checkSize(startFrame + count)
        if pcm.isEmpty { return }
        try pad(to: startFrame)
        try writeAll(fd, pcm, at: 44 + startFrame * bytesPerFrame)
        frames = max(frames, startFrame + count)
        pcm.withUnsafeBytes { raw in
            for index in stride(from: 0, to: raw.count, by: 2) {
                let sample = Int16(littleEndian: raw.loadUnaligned(fromByteOffset: index, as: Int16.self))
                peak = max(peak, Double(abs(Int(sample))) / 32768.0)
                if sample != 0 { nonSilentFrames += 1 }
            }
        }
    }
    func fit(to target: Int64) throws {
        try checkSize(target)
        if frames > target {
            guard ftruncate(fd, off_t(44 + target * bytesPerFrame)) == 0 else { throw posixError("trim WAV timeline") }
            frames = target
        } else { try pad(to: target) }
    }
    func checkpoint() throws {
        guard fd >= 0 else { return }
        try writeAll(fd, Self.header(bytes), at: 0)
        guard fsync(fd) == 0 else { throw posixError("flush \(filename)") }
    }
    func finalize() throws {
        guard fd >= 0 else { return }
        try checkpoint()
        let oldFD = fd
        fd = -1
        guard Darwin.close(oldFD) == 0 else { throw posixError("close \(filename)") }
    }
}

// All times are seconds in the shared SCStream/host monotonic clock. Each track maps
// through the same pause intervals; samples that straddle boundaries are trimmed.
private struct Timeline {
    let start: Double
    var pauses: [(start: Double, end: Double?)] = []
    var stoppedAt: Double?
    var paused: Bool { pauses.last.map { $0.end == nil } ?? false }
    mutating func pause(_ time: Double) {
        if !paused { pauses.append((max(start, time), nil)) }
    }
    mutating func resume(_ time: Double) {
        if paused { pauses[pauses.count - 1].end = max(pauses.last!.start, time) }
    }
    func activeTime(_ time: Double) -> Double {
        let end = max(start, min(time, stoppedAt ?? time))
        let removed = pauses.reduce(0.0) { sum, pause in
            sum + max(0, min(end, pause.end ?? end) - max(start, pause.start))
        }
        return max(0, end - start - removed)
    }
    func ranges(from begin: Double, to finish: Double) -> [(Double, Double)] {
        let lower = max(begin, start)
        let upper = min(finish, stoppedAt ?? finish)
        guard lower < upper else { return [] }
        var cursor = lower
        var result: [(Double, Double)] = []
        for pause in pauses {
            let end = pause.end ?? upper
            if end <= cursor { continue }
            if pause.start >= upper { break }
            if pause.start > cursor { result.append((cursor, min(pause.start, upper))) }
            cursor = max(cursor, end)
            if cursor >= upper { break }
        }
        if cursor < upper { result.append((cursor, upper)) }
        return result
    }
}

private func slice(_ input: AVAudioPCMBuffer, from: Int, to: Int) throws -> AVAudioPCMBuffer {
    let count = to - from
    guard count > 0, from >= 0, to <= Int(input.frameLength),
          let result = AVAudioPCMBuffer(pcmFormat: input.format, frameCapacity: AVAudioFrameCount(count)) else {
        throw RecorderError("Cannot allocate PCM input slice")
    }
    result.frameLength = AVAudioFrameCount(count)
    let source = UnsafeMutableAudioBufferListPointer(input.mutableAudioBufferList)
    let destination = UnsafeMutableAudioBufferListPointer(result.mutableAudioBufferList)
    let stride = Int(input.format.streamDescription.pointee.mBytesPerFrame)
    guard source.count == destination.count, stride > 0 else { throw RecorderError("Invalid PCM buffer layout") }
    for index in source.indices {
        guard let src = source[index].mData, let dst = destination[index].mData,
              (from + count) * stride <= Int(source[index].mDataByteSize), count * stride <= Int(destination[index].mDataByteSize) else {
            throw RecorderError("Invalid PCM buffer size")
        }
        memcpy(dst, src.advanced(by: from * stride), count * stride)
    }
    return result
}

private final class Track {
    let writer: PCMWriter
    private var converter: AVAudioConverter?
    private let target: AVAudioFormat
    private var segmentStart: Int64 = 0
    private var segmentOutput: Int64 = 0
    private var segmentInput: Int64 = 0
    private var expectedPTS: Double?
    private var sourceRate = 0.0
    private(set) var sampleBuffers = 0
    private(set) var sourceFrames: Int64 = 0
    private(set) var lastSampleAt: Double?
    init(directory: OutputDirectory, name: String) throws {
        writer = try PCMWriter(directory: directory, track: name)
        guard let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: outputRate, channels: 1, interleaved: true) else {
            throw RecorderError("Cannot create PCM16 format")
        }
        self.target = target
    }
    func accept(_ input: AVAudioPCMBuffer, timestamp: Double, timeline: Timeline) throws {
        sampleBuffers += 1
        lastSampleAt = timestamp
        let rate = input.format.sampleRate
        guard rate.isFinite, rate >= 8_000, rate <= 192_000,
              input.format.channelCount > 0, input.format.channelCount <= 32 else { throw RecorderError("Unsupported native audio format") }
        let end = timestamp + Double(input.frameLength) / rate
        for (begin, finish) in timeline.ranges(from: timestamp, to: end) {
            // Never include a source frame that lies inside a paused interval.
            let first = max(0, Int(ceil((begin - timestamp) * rate - 0.000_01)))
            let last = min(Int(input.frameLength), Int(floor((finish - timestamp) * rate + 0.000_01)))
            if first >= last { continue }
            let pcm = try slice(input, from: first, to: last)
            let pts = timestamp + Double(first) / rate
            let startFrame = Int64((timeline.activeTime(pts) * outputRate).rounded())
            let discontinuity = expectedPTS.map { abs($0 - pts) > 0.002 } ?? true
            if converter == nil || converter!.inputFormat != pcm.format || discontinuity {
                try finishConversion()
                guard let created = AVAudioConverter(from: pcm.format, to: target) else {
                    throw RecorderError("Cannot convert native audio to PCM16 mono16000")
                }
                created.downmix = true
                created.dither = false
                created.primeMethod = .normal
                converter = created
                sourceRate = rate
                segmentStart = startFrame
                segmentInput = 0
                segmentOutput = 0
            }
            sourceFrames += Int64(pcm.frameLength)
            segmentInput += Int64(pcm.frameLength)
            expectedPTS = timestamp + Double(last) / rate
            try convert(pcm, ending: false)
        }
    }
    private func convert(_ input: AVAudioPCMBuffer?, ending: Bool) throws {
        guard let converter = converter else { return }
        let capacity = AVAudioFrameCount(max(4096, Int(ceil(Double(input?.frameLength ?? 0) * outputRate / sourceRate)) + 1024))
        var supplied = false
        // Drain every available chunk, but cap iterations so malformed formats cannot spin.
        for _ in 0..<64 {
            guard let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { throw RecorderError("Cannot allocate converted audio") }
            var error: NSError?
            let status = converter.convert(to: output, error: &error) { _, state in
                if let input = input, !supplied {
                    supplied = true
                    state.pointee = .haveData
                    return input
                }
                state.pointee = ending ? .endOfStream : .noDataNow
                return nil
            }
            if let error = error { throw RecorderError("Audio conversion failed: \(error.localizedDescription)") }
            guard status != .error else { throw RecorderError("Audio converter returned error") }
            let expectedFrames = Int64((Double(segmentInput) * outputRate / sourceRate).rounded())
            let count = min(Int64(output.frameLength), max(0, expectedFrames - segmentOutput))
            if count > 0 {
                guard let data = output.int16ChannelData?[0] else { throw RecorderError("Converter did not return PCM16") }
                try writer.write(Data(bytes: data, count: Int(count * bytesPerFrame)), at: segmentStart + segmentOutput)
                segmentOutput += count
            }
            if status == .inputRanDry || status == .endOfStream { return }
            if output.frameLength == 0 { return }
        }
        throw RecorderError("Audio converter did not drain")
    }
    func finishConversion() throws {
        defer { converter = nil; expectedPTS = nil }
        try convert(nil, ending: true)
    }
    func stats(now: Double) -> [String: Any] {
        let stale = lastSampleAt.map { max(0, now - $0) } ?? 0
        return ["bytes": writer.bytes, "frames": writer.frames, "sampleRate": Int(outputRate), "channels": 1,
                "peak": writer.peak, "sampleBuffers": sampleBuffers, "sourceFrames": sourceFrames,
                "nonSilentFrames": writer.nonSilentFrames, "noSamples": sampleBuffers == 0,
                "silent": writer.peak == 0, "secondsSinceLastSample": stale]
    }
}

private final class RecordingSession {
    private(set) var timeline: Timeline
    let tracks: [String: Track]
    private(set) var finalized = false
    init(directory: OutputDirectory, mode: Mode, start: Double) throws {
        timeline = Timeline(start: start)
        var tracks: [String: Track] = [:]
        for name in mode.tracks { tracks[name] = try Track(directory: directory, name: name) }
        self.tracks = tracks
    }
    func accept(_ input: AVAudioPCMBuffer, timestamp: Double, track: String) throws {
        guard !finalized, timestamp.isFinite else { return }
        try tracks[track]?.accept(input, timestamp: timestamp, timeline: timeline)
    }
    func pause(at time: Double) throws {
        guard !timeline.paused, !finalized else { return }
        timeline.pause(time)
        let target = Int64((timeline.activeTime(time) * outputRate).rounded())
        for track in tracks.values {
            try track.finishConversion()
            // Trim a callback whose native buffer extended beyond the pause command.
            // Also freeze both tracks at exactly the same active-time boundary.
            try track.writer.fit(to: target)
            try track.writer.checkpoint()
        }
    }
    func resume(at time: Double) {
        guard !finalized else { return }
        timeline.resume(time)
    }
    func checkpoint() throws {
        for track in tracks.values { try track.writer.checkpoint() }
    }
    func stats(at time: Double) -> [String: Any] {
        ["event": "stats", "durationMs": Int((timeline.activeTime(time) * 1000).rounded()),
         "paused": timeline.paused, "tracks": tracks.mapValues { $0.stats(now: time) }]
    }
    func finalize(at time: Double) throws {
        guard !finalized else { return }
        finalized = true
        timeline.stoppedAt = time
        let target = Int64((timeline.activeTime(time) * outputRate).rounded())
        var failure: Error?
        for track in tracks.values {
            do {
                try track.finishConversion()
                // Pad only at finalization: no phantom input is attributed to an absent source.
                // Stats distinguish sourceFrames/sampleBuffers from this common timeline length.
                try track.writer.fit(to: target)
            } catch { if failure == nil { failure = error } }
            do { try track.writer.finalize() } catch { if failure == nil { failure = error } }
        }
        if let failure = failure { throw failure }
    }
}

private func pcmBuffer(_ sample: CMSampleBuffer) throws -> AVAudioPCMBuffer {
    guard sample.isValid, CMSampleBufferDataIsReady(sample),
          let description = CMSampleBufferGetFormatDescription(sample),
          let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(description),
          asbd.pointee.mFormatID == kAudioFormatLinearPCM,
          asbd.pointee.mChannelsPerFrame > 0, asbd.pointee.mChannelsPerFrame <= 32,
          asbd.pointee.mSampleRate >= 8_000, asbd.pointee.mSampleRate <= 192_000,
          let format = AVAudioFormat(streamDescription: asbd) else { throw RecorderError("Invalid native PCM sample format") }
    let frames = CMSampleBufferGetNumSamples(sample)
    guard frames > 0, frames <= Int(format.sampleRate * 2),
          let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)) else { throw RecorderError("Invalid native sample size") }
    output.frameLength = AVAudioFrameCount(frames)
    let size = MemoryLayout<AudioBufferList>.size + (Int(format.channelCount) - 1) * MemoryLayout<AudioBuffer>.size
    let storage = UnsafeMutableRawPointer.allocate(byteCount: size, alignment: 16)
    defer { storage.deallocate() }
    let list = storage.bindMemory(to: AudioBufferList.self, capacity: 1)
    var block: CMBlockBuffer?
    let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(sample, bufferListSizeNeededOut: nil,
        bufferListOut: list, bufferListSize: size, blockBufferAllocator: kCFAllocatorDefault,
        blockBufferMemoryAllocator: kCFAllocatorDefault, flags: UInt32(kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment), blockBufferOut: &block)
    guard status == noErr else { throw RecorderError("Native audio buffer list error \(status)") }
    let source = UnsafeMutableAudioBufferListPointer(list)
    let destination = UnsafeMutableAudioBufferListPointer(output.mutableAudioBufferList)
    guard source.count == destination.count else { throw RecorderError("Native audio buffer count mismatch") }
    try withExtendedLifetime(block) {
        for index in source.indices {
            let count = Int(destination[index].mDataByteSize)
            guard let src = source[index].mData, let dst = destination[index].mData,
                  count > 0, Int(source[index].mDataByteSize) >= count else { throw RecorderError("Native audio buffer truncated") }
            memcpy(dst, src, count)
        }
    }
    return output
}

// Capture APIs exist exclusively in this real-recording class. Self-test does not
// instantiate it. All mutable state and callbacks are confined to one serial queue.
@available(macOS 15.0, *)
private final class NativeRecorder: NSObject, SCStreamOutput, SCStreamDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
    let queue = DispatchQueue(label: "local.recorder.serial", qos: .userInitiated)
    private let deviceQueue = DispatchQueue(label: "local.recorder.microphone", qos: .userInitiated)
    private let options: Options
    private let directory: OutputDirectory
    private var session: RecordingSession?
    private var capture: SCStream?
    private var microphoneCapture: AVCaptureSession?
    private var microphoneObservers: [NSObjectProtocol] = []
    private var lastError: String?
    private var timer: DispatchSourceTimer?
    private var signals: [DispatchSourceSignal] = []
    private var starting = false
    private var stopping = false
    private var exitStatus: Int32 = 0
    private var stopTime: Double?
    init(options: Options, directory: OutputDirectory) {
        self.options = options
        self.directory = directory
        super.init()
    }
    func run() {
        for number in [SIGTERM, SIGINT, SIGHUP] {
            signal(number, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: number, queue: queue)
            source.setEventHandler { [self] in stop(reason: "signal \(number)") }
            source.resume()
            signals.append(source)
        }
        // The reader is started before any permission operation. EOF stops even
        // while an OS permission dialog or ScreenCaptureKit startup is pending.
        DispatchQueue.global(qos: .userInitiated).async { [self] in readCommands() }
        queue.async { [self] in begin() }
    }
    private func readCommands() {
        var pending = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while true {
            let count = Darwin.read(STDIN_FILENO, &buffer, buffer.count)
            if count < 0 && errno == EINTR { continue }
            if count <= 0 {
                if !pending.isEmpty, let command = String(data: pending, encoding: .utf8) {
                    queue.async { [self] in commandLine(command) }
                }
                queue.async { [self] in stop(reason: "stdin EOF") }
                return
            }
            pending.append(contentsOf: buffer.prefix(count))
            while let newline = pending.firstIndex(of: 10) {
                let line = pending.prefix(upTo: newline)
                pending.removeSubrange(...newline)
                guard line.count <= 1024, let command = String(data: line, encoding: .utf8) else {
                    queue.async { [self] in fail(RecorderError("Invalid stdin command")) }
                    return
                }
                queue.async { [self] in commandLine(command) }
            }
            if pending.count > 1024 {
                queue.async { [self] in fail(RecorderError("Stdin command exceeds 1024 bytes")) }
                return
            }
        }
    }
    private func begin() {
        guard !stopping else { return }
        if options.mode.tracks.contains("microphone") {
            switch AVCaptureDevice.authorizationStatus(for: .audio) {
            case .denied, .restricted:
                fail(RecorderError("Microphone permission denied or restricted; enable it in System Settings")); return
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .audio) { [self] allowed in
                    queue.async { [self] in
                        guard !stopping else { return }
                        if allowed { beginAuthorizedCapture() } else { fail(RecorderError("Microphone permission denied")) }
                    }
                }
                return
            default: break
            }
        }
        beginAuthorizedCapture()
    }
    private func beginAuthorizedCapture() {
        guard !stopping else { return }
        // Microphone-only MUST NOT enumerate displays or request screen permission.
        if options.mode == .mic { startMicrophoneOnly() } else { discover() }
    }
    private func startMicrophoneOnly() {
        do {
            session = try RecordingSession(directory: directory, mode: .mic, start: hostNow())
            let microphone = AVCaptureSession()
            microphoneCapture = microphone
            starting = true
            for name in [AVCaptureSession.runtimeErrorNotification, AVCaptureSession.wasInterruptedNotification] {
                let observer = NotificationCenter.default.addObserver(forName: name, object: microphone, queue: nil) { [self] notice in
                    let reason = (notice.userInfo?[AVCaptureSessionErrorKey] as? Error)?.localizedDescription ?? notice.name.rawValue
                    queue.async { [self] in fail(RecorderError("Microphone capture interrupted: \(reason)")) }
                }
                microphoneObservers.append(observer)
            }
            deviceQueue.async { [self] in
                do {
                    guard let device = AVCaptureDevice.default(for: .audio) else { throw RecorderError("No microphone input device available") }
                    let input = try AVCaptureDeviceInput(device: device)
                    let output = AVCaptureAudioDataOutput()
                    output.setSampleBufferDelegate(self, queue: queue)
                    microphone.beginConfiguration()
                    guard microphone.canAddInput(input), microphone.canAddOutput(output) else {
                        microphone.commitConfiguration()
                        throw RecorderError("Microphone input/output cannot be added")
                    }
                    microphone.addInput(input)
                    microphone.addOutput(output)
                    microphone.commitConfiguration()
                    microphone.startRunning()
                    let running = microphone.isRunning
                    queue.async { [self] in
                        starting = false
                        if stopping { stopCapture(); return }
                        guard running else { fail(RecorderError("Microphone capture did not start")); return }
                        emit(event("ready"))
                        startStats()
                    }
                } catch {
                    queue.async { [self] in
                        starting = false
                        if stopping { stopCapture() } else { fail(error) }
                    }
                }
            }
        } catch { fail(error) }
    }
    private func discover() {
        guard !stopping else { return }
        SCShareableContent.getExcludingDesktopWindows(true, onScreenWindowsOnly: true) { [self] content, error in
            queue.async { [self] in
                guard !stopping else { return }
                if let error = error { fail(RecorderError("Screen/system audio capture permission or discovery failed: \(error.localizedDescription)")); return }
                guard let display = content?.displays.first else { fail(RecorderError("No shareable display; audio capture cannot start")); return }
                do {
                    let config = SCStreamConfiguration()
                    config.capturesAudio = options.mode.tracks.contains("system")
                    config.captureMicrophone = options.mode.tracks.contains("microphone")
                    config.sampleRate = 48_000
                    config.channelCount = 2
                    config.excludesCurrentProcessAudio = false
                    config.width = 2
                    config.height = 2
                    config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
                    config.showsCursor = false
                    config.queueDepth = 3
                    let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
                    let stream = SCStream(filter: filter, configuration: config, delegate: self)
                    // Deliberately NEVER register .screen or SCRecordingOutput.
                    if config.capturesAudio { try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue) }
                    if config.captureMicrophone { try stream.addStreamOutput(self, type: .microphone, sampleHandlerQueue: queue) }
                    session = try RecordingSession(directory: directory, mode: options.mode, start: hostNow())
                    capture = stream
                    starting = true
                    stream.startCapture { [self] error in
                        queue.async { [self] in
                            starting = false
                            if stopping { stopCapture(); return }
                            if let error = error { fail(RecorderError("Capture startup failed: \(error.localizedDescription)")); return }
                            emit(event("ready"))
                            startStats()
                        }
                    }
                } catch { fail(error) }
            }
        }
    }
    private func event(_ name: String) -> [String: Any] {
        var payload = session?.stats(at: hostNow()) ?? ["tracks": [String: Any]()]
        payload["event"] = name
        return payload
    }
    private func startStats() {
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: 1.0, leeway: .milliseconds(50))
        timer.setEventHandler { [self] in
            do {
                try session?.checkpoint()
                if let session = session { emit(session.stats(at: hostNow())) }
            } catch { fail(error) }
        }
        timer.resume()
        self.timer = timer
    }
    private func commandLine(_ line: String) {
        guard !stopping else { return }
        let command = line.trimmingCharacters(in: .whitespacesAndNewlines)
        switch command {
        case "stop": stop(reason: "stop command")
        case "pause", "resume":
            guard let session = session, !starting else { fail(RecorderError("Capture not ready; wait for ready before pause/resume")); return }
            do {
                if command == "pause" { try session.pause(at: hostNow()) }
                else { session.resume(at: hostNow()) }
                emit(event(command == "pause" ? "paused" : "resumed"))
                emit(session.stats(at: hostNow()))
            } catch { fail(error) }
        case "": break
        default: fail(RecorderError("Unknown command; expected pause, resume or stop"))
        }
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard !stopping, let session = session else { return }
        let track: String
        switch type { case .audio: track = "system"; case .microphone: track = "microphone"; default: return }
        guard session.tracks[track] != nil else { return }
        accept(sampleBuffer, track: track, clock: stream.synchronizationClock, session: session)
    }
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard !stopping, let session = session else { return }
        accept(sampleBuffer, track: "microphone", clock: microphoneCapture?.synchronizationClock, session: session)
    }
    private func accept(_ sampleBuffer: CMSampleBuffer, track: String, clock: CMClock?, session: RecordingSession) {
        do {
            var pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            if let clock = clock { pts = CMSyncConvertTime(pts, from: clock, to: hostClock) }
            let seconds = CMTimeGetSeconds(pts)
            guard seconds.isFinite, abs(seconds - hostNow()) < 60 else { throw RecorderError("Audio timestamp is not on the shared host clock") }
            try session.accept(pcmBuffer(sampleBuffer), timestamp: seconds, track: track)
        } catch { fail(RecorderError("\(track): \(error)")) }
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        queue.async { [self] in
            guard !stopping else { return }
            fail(RecorderError("Capture stopped: \(error.localizedDescription)"))
        }
    }
    private func fail(_ error: Error) {
        guard !stopping else { return }
        exitStatus = 1
        lastError = String(describing: error)
        emit(["event": "error", "message": lastError!])
        stop(reason: "error")
    }
    private func stop(reason: String) {
        guard !stopping else { return }
        stopping = true
        stopTime = hostNow()
        timer?.cancel()
        timer = nil
        // Bound teardown even if an OS permission/start/stop completion never returns.
        queue.asyncAfter(deadline: .now() + 3) { [self] in
            exitStatus = 1
            lastError = "Capture teardown timed out; PCM files finalized before exit"
            finish(reason: "\(reason); capture teardown timeout")
        }
        if starting { return }
        if capture == nil && microphoneCapture == nil { finish(reason: reason) } else { stopCapture() }
    }
    private func stopCapture() {
        if let microphone = microphoneCapture {
            deviceQueue.async { [self] in
                microphone.stopRunning()
                queue.async { [self] in finish(reason: "microphone stopped") }
            }
        } else if let capture = capture {
            capture.stopCapture { [self] error in
                queue.async { [self] in
                    if let error = error {
                        exitStatus = 1
                        lastError = "Capture teardown: \(error.localizedDescription)"
                        emit(["event": "error", "message": lastError!])
                    }
                    finish(reason: "capture stopped")
                }
            }
        } else { finish(reason: "stopped before capture") }
    }
    private func finish(reason: String) -> Never {
        let end = stopTime ?? hostNow()
        do {
            try session?.finalize(at: end)
        } catch {
            exitStatus = 1
            lastError = "WAV finalization: \(error)"
            emit(["event": "error", "message": lastError!])
        }
        var payload = session?.stats(at: end) ?? ["tracks": [String: Any]()]
        if let session = session {
            emit(session.stats(at: end))
            let absent = session.tracks.filter { $0.value.sourceFrames == 0 }.map { $0.key }.sorted()
            if !absent.isEmpty {
                exitStatus = 1
                lastError = "No source samples received outside pauses: \(absent.joined(separator: ", ")); WAV may contain timeline padding only"
                emit(["event": "error", "message": lastError!])
            }
            let silent = session.tracks.filter { $0.value.writer.peak == 0 }.map { $0.key }.sorted()
            if !silent.isEmpty { payload["warning"] = "Silent source(s): \(silent.joined(separator: ", ")); not evidence of speech" }
        } else {
            exitStatus = 1
            if lastError == nil { lastError = "Recording stopped before any track started" }
        }
        payload["event"] = "stopped"
        payload["message"] = reason
        payload["ok"] = exitStatus == 0
        if let lastError = lastError { payload["error"] = lastError }
        emit(payload)
        for observer in microphoneObservers { NotificationCenter.default.removeObserver(observer) }
        exit(exitStatus)
    }
}

// Offline fixture: the same Track/AVAudioConverter/PCMWriter path as real capture.
// Generates planar 44.1k stereo and interleaved 48k stereo, with distinct frequencies.
private func sine(rate: Double, channels: AVAudioChannelCount, interleaved: Bool, frequency: Double, start: Int, count: Int) throws -> AVAudioPCMBuffer {
    guard let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: channels, interleaved: interleaved),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)),
          let pointers = buffer.floatChannelData else { throw RecorderError("Cannot allocate synthetic fixture") }
    buffer.frameLength = AVAudioFrameCount(count)
    for frame in 0..<count {
        let value = Float(0.5 * sin(2 * Double.pi * frequency * Double(start + frame) / rate))
        for channel in 0..<Int(channels) {
            if interleaved { pointers[0][frame * Int(channels) + channel] = value }
            else { pointers[channel][frame] = value }
        }
    }
    return buffer
}
private func assertTest(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw RecorderError("Self-test failed: \(message)") }
}
private func selfTest(options: Options, directory: OutputDirectory) throws {
    var boundary = Timeline(start: 100)
    boundary.pause(100.4)
    boundary.resume(100.9)
    let ranges = boundary.ranges(from: 100.39, to: 100.91)
    try assertTest(ranges.count == 2 && abs(ranges[0].1 - 100.4) < 0.00001 && abs(ranges[1].0 - 100.9) < 0.00001, "timestamp boundary split")
    let base = 100.0
    let session = try RecordingSession(directory: directory, mode: .both, start: base)
    func event(_ name: String, _ time: Double) {
        var payload = session.stats(at: time)
        payload["event"] = name
        payload["selfTest"] = true
        emit(payload)
    }
    event("ready", base)
    var pausedBytes: [String: Int64] = [:]
    for chunk in 0..<150 {
        let time = base + Double(chunk) / 100
        if chunk == 40 {
            try session.pause(at: time)
            pausedBytes = session.tracks.mapValues { $0.writer.bytes }
            event("paused", time)
        }
        if chunk == 90 {
            try assertTest(session.tracks.allSatisfy { $0.value.writer.bytes == pausedBytes[$0.key] }, "paused audio changed payload length")
            session.resume(at: time)
            event("resumed", time)
        }
        // Reverse callback order to prove per-track callbacks do not establish separate origins.
        for name in ["system", "microphone"] {
            if name == "system" && chunk < 3 { continue } // delayed source: common-origin zero padding
            let rate = name == "system" ? 48_000.0 : 44_100.0
            let count = Int(rate / 100)
            let input = try sine(rate: rate, channels: 2, interleaved: name == "system",
                                 frequency: name == "system" ? 880 : 440, start: chunk * count, count: count)
            try session.accept(input, timestamp: time, track: name)
        }
        if chunk % 25 == 0 {
            try session.checkpoint()
            for (name, track) in session.tracks {
                let bytes = try Data(contentsOf: URL(fileURLWithPath: directory.path).appendingPathComponent("\(name).wav"))
                try assertTest(bytes.prefix(44) == PCMWriter.header(track.writer.bytes), "periodic header checkpoint")
                try assertTest(bytes.count == 44 + Int(track.writer.bytes), "periodic payload length")
            }
        }
    }
    try session.finalize(at: base + 1.5)
    // Idempotent finalize and exact common 1.0-second timeline (0.5 seconds excluded).
    try session.finalize(at: base + 2)
    var frequencies: [String: Double] = [:]
    for name in ["microphone", "system"] {
        let data = try Data(contentsOf: URL(fileURLWithPath: directory.path).appendingPathComponent("\(name).wav"))
        try assertTest(data.count == 32_044, "\(name) byte count \(data.count), expected 32044")
        try assertTest(data.prefix(44) == PCMWriter.header(32_000), "\(name) header not finalized PCM16 mono16000")
        let samples: [Int16] = data.dropFirst(44).withUnsafeBytes { raw in
            stride(from: 0, to: raw.count, by: 2).map { Int16(littleEndian: raw.loadUnaligned(fromByteOffset: $0, as: Int16.self)) }
        }
        let peak = samples.map { abs(Int($0)) }.max() ?? 0
        try assertTest(peak > 8000 && peak < 30_000, "\(name) nonzero amplitude/downmix")
        var crossings = 0
        for frame in 801..<5600 { if samples[frame - 1] <= 0 && samples[frame] > 0 { crossings += 1 } }
        let frequency = Double(crossings) * outputRate / 4800
        frequencies[name] = frequency
        let expected = name == "system" ? 880.0 : 440.0
        try assertTest(abs(frequency - expected) < 8, "\(name) tone/conversion \(frequency), expected \(expected)")
        try assertTest(session.tracks[name]!.sourceFrames == Int64(name == "system" ? 46_560 : 44_100), "pause source frames were not excluded")
        if name == "system" { try assertTest(samples.prefix(480).allSatisfy { $0 == 0 }, "delayed track lost common timeline origin") }
    }
    emit(session.stats(at: base + 1.5))
    var stopped = session.stats(at: base + 1.5)
    stopped["event"] = "stopped"
    stopped["selfTest"] = true
    stopped["selfTestPassed"] = true
    stopped["ok"] = true
    stopped["message"] = "Offline conversion, separate tones, pause exclusion, WAV checkpoint/finalize and common timeline passed"
    stopped["frequencies"] = frequencies
    emit(stopped)
}

signal(SIGPIPE, SIG_IGN)
do {
    let options = try Options.parse(Array(CommandLine.arguments.dropFirst()))
    let directory = try OutputDirectory(options.output)
    if options.selfTest {
        try selfTest(options: options, directory: directory)
        exit(0)
    }
    if #available(macOS 15.0, *) {
        let recorder = NativeRecorder(options: options, directory: directory)
        recorder.run()
        dispatchMain()
    } else {
        throw RecorderError("ScreenCaptureKit microphone capture requires macOS 15 or later")
    }
} catch {
    emit(["event": "error", "message": String(describing: error)])
    exit(1)
}
