import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Settings, Volume2, VolumeX } from "lucide-react";

export default function WorkoutTimer() {
  // Cài đặt timer
  const [settings, setSettings] = useState({
    workTime: 10, // giây
    restTime: 5, // giây
    exercises: 3, // số bài tập
    rounds: 2, // số vòng
  });

  // Cài đặt bổ sung
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Trạng thái timer
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(settings.workTime);
  const [currentPhase, setCurrentPhase] = useState("work"); // 'work' hoặc 'rest'
  const [currentExercise, setCurrentExercise] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const intervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const speechSynthRef = useRef(null);

  // Wake Lock functions
  const requestWakeLock = async () => {
    if (!keepScreenOn) return;

    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        console.log("Wake lock activated");
      } else {
        // Fallback for iOS - create invisible video
        const video = document.createElement("video");
        video.src =
          "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAAGW1kYXQAAAGzABAHAAABthADAowdbb9/AAAC6W1vb3YAAABsbXZoZAAAAAB8JbCAfCWwgAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIVdHJhawAAAFx0a2hkAAAAD3wlsIB8JbCAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAALAAAACgAAAAAAJGVkdHMAAAAcZWxzdAAAAAAAAAABAAAAAQAACgAAAAABAAAAAAG2bWRpYQAAACBtZGhkAAAAAHwlsIB8JbCAAAAACgAAAAAVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABYW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAQFzdGJsAAAAr3N0c2QAAAAAAAAAAQAAAJ9hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAALAAKABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAALWF2Y0MBQsAN/+EAFWdCwA3ZAsTaBYmOhP/y8+hkiUZALwABAAEAAAMAEAADAAADAAADAAAHBeF2zA==";
        video.setAttribute("loop", "");
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.style.position = "absolute";
        video.style.left = "-9999px";
        video.style.width = "1px";
        video.style.height = "1px";
        document.body.appendChild(video);
        await video.play();
        wakeLockRef.current = { type: "video", element: video };
        console.log("Video wake lock activated");
      }
    } catch (err) {
      console.error("Wake lock failed:", err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      if (wakeLockRef.current.type === "video") {
        wakeLockRef.current.element.remove();
      } else {
        wakeLockRef.current.release();
      }
      wakeLockRef.current = null;
      console.log("Wake lock released");
    }
  };

  // Speech synthesis function
  const speak = (text) => {
    if (!soundEnabled || !("speechSynthesis" in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Prefer English voice for numbers
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((voice) => voice.lang.startsWith("en"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Reset timer về trạng thái ban đầu
  const resetTimer = () => {
    setIsRunning(false);
    setCurrentTime(settings.workTime);
    setCurrentPhase("work");
    setCurrentExercise(1);
    setCurrentRound(1);
    setIsFinished(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    releaseWakeLock();
  };

  // Chuyển sang phase tiếp theo
  const nextPhase = useCallback(() => {
    console.log(
      `Current: Round ${currentRound}, Exercise ${currentExercise}, Phase: ${currentPhase}`
    );

    if (currentPhase === "work") {
      // Work xong → chuyển sang Rest (cùng exercise)
      setCurrentPhase("rest");
      setCurrentTime(settings.restTime);
      speak("Rest");
      console.log(`→ Chuyển sang Rest của Exercise ${currentExercise}`);
    } else {
      // Rest xong → chuyển sang Work của exercise tiếp theo
      if (currentExercise < settings.exercises) {
        // Còn exercises trong round hiện tại
        const nextExercise = currentExercise + 1;
        setCurrentExercise(nextExercise);
        setCurrentPhase("work");
        setCurrentTime(settings.workTime);
        speak(`Exercise ${nextExercise}. Work`);
        console.log(`→ Chuyển sang Work của Exercise ${nextExercise}`);
      } else {
        // Hết exercises trong round → chuyển round mới
        if (currentRound < settings.rounds) {
          const nextRound = currentRound + 1;
          setCurrentRound(nextRound);
          setCurrentExercise(1);
          setCurrentPhase("work");
          setCurrentTime(settings.workTime);
          speak(`Round ${nextRound}. Exercise 1. Work`);
          console.log(`→ Chuyển sang Round ${nextRound}, Exercise 1, Work`);
        } else {
          // Hết tất cả
          setIsFinished(true);
          setIsRunning(false);
          speak("Workout completed. Great job!");
          releaseWakeLock();
          console.log(`→ Hoàn thành!`);
        }
      }
    }
  }, [currentRound, currentExercise, currentPhase, settings, soundEnabled]);

  // Effect để chạy timer
  useEffect(() => {
    if (isRunning && !isFinished) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev <= 1) {
            nextPhase();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isFinished, nextPhase]);

  // Effect riêng cho wake lock
  useEffect(() => {
    if (isRunning && keepScreenOn) {
      requestWakeLock();
    } else if (!isRunning) {
      releaseWakeLock();
    }
  }, [keepScreenOn, isRunning]);

  // Effect để load voices khi component mount
  useEffect(() => {
    if ("speechSynthesis" in window) {
      // Load voices
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
      }

      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      };
    }
  }, []);

  // Effect để announce khi start lần đầu
  useEffect(() => {
    if (
      isRunning &&
      currentPhase === "work" &&
      currentExercise === 1 &&
      currentRound === 1 &&
      currentTime === settings.workTime
    ) {
      speak("Round 1. Exercise 1. Work");
    }
  }, [isRunning]);

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Format time thành MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Cập nhật settings
  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    resetTimer();
    setCurrentTime(newSettings.workTime);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/20 max-w-md w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-white">Workout Timer</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-all"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-white/10 rounded-2xl border border-white/20">
            <h3 className="text-white font-semibold mb-4">Cài đặt</h3>

            {/* Timer Settings */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-white/80 text-sm mb-1">Work (giây)</label>
                <input
                  type="number"
                  value={settings.workTime}
                  onChange={(e) =>
                    updateSettings({ ...settings, workTime: parseInt(e.target.value) || 10 })
                  }
                  className="w-full px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/50 border border-white/30"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Rest (giây)</label>
                <input
                  type="number"
                  value={settings.restTime}
                  onChange={(e) =>
                    updateSettings({ ...settings, restTime: parseInt(e.target.value) || 5 })
                  }
                  className="w-full px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/50 border border-white/30"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Bài tập</label>
                <input
                  type="number"
                  value={settings.exercises}
                  onChange={(e) =>
                    updateSettings({ ...settings, exercises: parseInt(e.target.value) || 3 })
                  }
                  className="w-full px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/50 border border-white/30"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-1">Vòng</label>
                <input
                  type="number"
                  value={settings.rounds}
                  onChange={(e) =>
                    updateSettings({ ...settings, rounds: parseInt(e.target.value) || 2 })
                  }
                  className="w-full px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/50 border border-white/30"
                  min="1"
                />
              </div>
            </div>

            {/* Additional Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">Giữ màn hình sáng</span>
                <button
                  onClick={() => setKeepScreenOn(!keepScreenOn)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    keepScreenOn ? "bg-green-500" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      keepScreenOn ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm flex items-center gap-2">
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  Âm thanh thông báo
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => speak("Test sound")}
                    disabled={!soundEnabled}
                    className={`px-2 py-1 text-xs rounded ${
                      soundEnabled
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Test
                  </button>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      soundEnabled ? "bg-green-500" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        soundEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="text-center mb-6">
          <div className="text-white/80 text-sm mb-2">
            Vòng {currentRound}/{settings.rounds} • Bài tập {currentExercise}/{settings.exercises}
          </div>
          <div
            className={`text-3xl font-bold mb-2 ${
              currentPhase === "work" ? "text-green-400" : "text-blue-400"
            }`}
          >
            {currentPhase === "work" ? "WORK" : "REST"}
          </div>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-8">
          <div
            className={`text-7xl font-mono font-bold ${
              currentPhase === "work" ? "text-green-400" : "text-blue-400"
            } ${currentTime <= 3 && isRunning ? "animate-pulse" : ""}`}
          >
            {formatTime(currentTime)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${
                currentPhase === "work" ? "bg-green-400" : "bg-blue-400"
              }`}
              style={{
                width: `${
                  (((currentPhase === "work" ? settings.workTime : settings.restTime) -
                    currentTime) /
                    (currentPhase === "work" ? settings.workTime : settings.restTime)) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setIsRunning(!isRunning)}
            disabled={isFinished}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              isFinished
                ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                : isRunning
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isRunning ? "Pause" : "Start"}
          </button>

          <button
            onClick={resetTimer}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        </div>

        {/* Finished Message */}
        {isFinished && (
          <div className="mt-6 text-center">
            <div className="text-2xl font-bold text-green-400 mb-2">🎉 Hoàn thành!</div>
            <div className="text-white/80">Bạn đã hoàn thành tất cả bài tập!</div>
          </div>
        )}
      </div>
    </div>
  );
}
