import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Settings, Volume2, VolumeX } from "lucide-react";

export default function WorkoutTimer() {
  // Hằng số cho localStorage keys
  const STORAGE_KEYS = {
    TIMER_SETTINGS: "workoutTimer_settings",
    ADDITIONAL_SETTINGS: "workoutTimer_additionalSettings",
  };

  // Cài đặt mặc định
  const defaultSettings = {
    workTime: 10, // giây
    restTime: 5, // giây
    roundRestTime: 30, // giây nghỉ giữa các round
    exercises: 3, // số bài tập
    rounds: 2, // số vòng
  };

  const defaultAdditionalSettings = {
    keepScreenOn: true,
    soundEnabled: true,
  };

  // Hàm load settings từ localStorage
  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.TIMER_SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Merge với defaultSettings để đảm bảo không thiếu field nào
        return { ...defaultSettings, ...parsed };
      }
      return defaultSettings;
    } catch (error) {
      console.warn("Không thể load timer settings từ localStorage:", error);
      return defaultSettings;
    }
  };

  const loadAdditionalSettings = () => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.ADDITIONAL_SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Merge với defaultAdditionalSettings để đảm bảo không thiếu field nào
        return { ...defaultAdditionalSettings, ...parsed };
      }
      return defaultAdditionalSettings;
    } catch (error) {
      console.warn("Không thể load additional settings từ localStorage:", error);
      return defaultAdditionalSettings;
    }
  };

  // Hàm save settings vào localStorage
  const saveSettings = (settings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TIMER_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.warn("Không thể save timer settings vào localStorage:", error);
    }
  };

  const saveAdditionalSettings = (additionalSettings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ADDITIONAL_SETTINGS, JSON.stringify(additionalSettings));
    } catch (error) {
      console.warn("Không thể save additional settings vào localStorage:", error);
    }
  };

  // States cho timer settings - load từ localStorage
  const [settings, setSettings] = useState(loadSettings);
  const [keepScreenOn, setKeepScreenOn] = useState(() => loadAdditionalSettings().keepScreenOn);
  const [soundEnabled, setSoundEnabled] = useState(() => loadAdditionalSettings().soundEnabled);

  // States cho timer
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(settings.workTime);
  const [currentPhase, setCurrentPhase] = useState("work"); // 'work', 'rest', hoặc 'roundRest'
  const [currentExercise, setCurrentExercise] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const intervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const videoRef = useRef(null);
  const preventSleepMethodRef = useRef(null);

  // Wake Lock API + Fallback methods
  const enableWakeLock = useCallback(async () => {
    if (!keepScreenOn) return;

    try {
      // Method 1: Wake Lock API (modern browsers)
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        preventSleepMethodRef.current = "wakeLock";
        console.log("Wake Lock enabled");
        return;
      }
    } catch (error) {
      console.warn("Wake Lock failed:", error);
    }

    try {
      // Method 2: Hidden video with audio (fallback)
      if (videoRef.current) {
        const video = videoRef.current;
        video.muted = true;
        video.loop = true;

        // Create a minimal video blob
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, 1, 1);

        const stream = canvas.captureStream(1);
        video.srcObject = stream;
        await video.play();

        preventSleepMethodRef.current = "video";
        console.log("Video fallback enabled");
        return;
      }
    } catch (error) {
      console.warn("Video fallback failed:", error);
    }

    // Method 3: Periodic interaction simulation (last resort)
    try {
      const interval = setInterval(() => {
        if (isRunning && keepScreenOn) {
          // Create a minimal DOM interaction to prevent sleep
          const tempDiv = document.createElement("div");
          tempDiv.style.position = "absolute";
          tempDiv.style.top = "-1px";
          tempDiv.style.left = "-1px";
          tempDiv.style.width = "1px";
          tempDiv.style.height = "1px";
          tempDiv.style.opacity = "0";
          document.body.appendChild(tempDiv);
          setTimeout(() => {
            if (document.body.contains(tempDiv)) {
              document.body.removeChild(tempDiv);
            }
          }, 10);
        } else {
          clearInterval(interval);
        }
      }, 30000); // Every 30 seconds

      preventSleepMethodRef.current = "interaction";
      console.log("Interaction fallback enabled");
    } catch (error) {
      console.warn("All wake methods failed:", error);
    }
  }, [keepScreenOn, isRunning]);

  const disableWakeLock = useCallback(() => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log("Wake Lock disabled");
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        console.log("Video fallback disabled");
      }

      preventSleepMethodRef.current = null;
    } catch (error) {
      console.warn("Error disabling wake lock:", error);
    }
  }, []);

  // Effect để save settings khi thay đổi
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Effect để save additional settings khi thay đổi
  useEffect(() => {
    saveAdditionalSettings({ keepScreenOn, soundEnabled });
  }, [keepScreenOn, soundEnabled]);

  // Wake lock management
  useEffect(() => {
    if (isRunning && keepScreenOn) {
      enableWakeLock();
    } else {
      disableWakeLock();
    }

    return () => {
      disableWakeLock();
    };
  }, [isRunning, keepScreenOn, enableWakeLock, disableWakeLock]);

  // Speech synthesis function
  const speak = useCallback(
    (text) => {
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
    },
    [soundEnabled]
  );

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
  };

  // Chuyển sang phase tiếp theo
  const nextPhase = useCallback(() => {
    if (currentPhase === "work") {
      // Work xong → chuyển sang Rest (cùng exercise)
      setCurrentPhase("rest");
      setCurrentTime(settings.restTime);
      speak("Rest");
    } else if (currentPhase === "rest") {
      // Rest xong → chuyển sang Work của exercise tiếp theo
      if (currentExercise < settings.exercises) {
        // Còn exercises trong round hiện tại
        const nextExercise = currentExercise + 1;
        setCurrentExercise(nextExercise);
        setCurrentPhase("work");
        setCurrentTime(settings.workTime);
        speak(`Exercise ${nextExercise}. Work`);
      } else {
        // Hết exercises trong round → chuyển round mới hoặc round rest
        if (currentRound < settings.rounds) {
          // Có round tiếp theo → chuyển sang round rest
          setCurrentPhase("roundRest");
          setCurrentTime(settings.roundRestTime);
          speak(`Round ${currentRound} completed. Round rest`);
        } else {
          // Hết tất cả
          setIsFinished(true);
          setIsRunning(false);
          speak("Workout completed. Great job!");
        }
      }
    } else if (currentPhase === "roundRest") {
      // Round rest xong → chuyển sang round mới
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);
      setCurrentExercise(1);
      setCurrentPhase("work");
      setCurrentTime(settings.workTime);
      speak(`Round ${nextRound}. Exercise 1. Work`);
    }
  }, [currentRound, currentExercise, currentPhase, settings, speak]);

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
  }, [
    isRunning,
    currentPhase,
    currentExercise,
    currentRound,
    currentTime,
    settings.workTime,
    speak,
  ]);

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      disableWakeLock();
    };
  }, [disableWakeLock]);

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
    // saveSettings sẽ được gọi tự động qua useEffect
  };

  // Cập nhật keepScreenOn
  const updateKeepScreenOn = (value) => {
    setKeepScreenOn(value);
    // saveAdditionalSettings sẽ được gọi tự động qua useEffect
  };

  // Cập nhật soundEnabled
  const updateSoundEnabled = (value) => {
    setSoundEnabled(value);
    // saveAdditionalSettings sẽ được gọi tự động qua useEffect
  };

  // Hàm reset về cài đặt mặc định
  const resetToDefaults = () => {
    if (confirm("Bạn có chắc muốn reset về cài đặt mặc định?")) {
      updateSettings(defaultSettings);
      updateKeepScreenOn(defaultAdditionalSettings.keepScreenOn);
      updateSoundEnabled(defaultAdditionalSettings.soundEnabled);
    }
  };

  // Get current wake method status
  const getWakeStatus = () => {
    if (!keepScreenOn) return "⚪ Tắt";
    if (!isRunning) return "⚪ Dừng";

    switch (preventSleepMethodRef.current) {
      case "wakeLock":
        return "🔒 Wake Lock";
      case "video":
        return "📹 Video";
      case "interaction":
        return "👆 Interaction";
      default:
        return "⚡ Đang kích hoạt...";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      {/* Hidden video for fallback */}
      <video
        ref={videoRef}
        style={{
          position: "absolute",
          top: "-1px",
          left: "-1px",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        muted
        playsInline
      />

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
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Cài đặt</h3>
              <button
                onClick={resetToDefaults}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-all"
              >
                Reset
              </button>
            </div>

            {/* Timer Settings */}
            <div className="space-y-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-1">Work (giây)</label>
                  <input
                    type="number"
                    value={settings.workTime}
                    onChange={(e) =>
                      updateSettings({ ...settings, workTime: parseInt(e.target.value) || 1 })
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
                      updateSettings({ ...settings, restTime: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/50 border border-white/30"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/80 text-sm mb-1">
                  Round Rest (giây)
                  <span className="block text-white/60 text-xs">Nghỉ giữa các round</span>
                </label>
                <input
                  type="number"
                  value={settings.roundRestTime}
                  onChange={(e) =>
                    updateSettings({ ...settings, roundRestTime: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/50 border border-white/30"
                  min="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-1">Bài tập</label>
                  <input
                    type="number"
                    value={settings.exercises}
                    onChange={(e) =>
                      updateSettings({ ...settings, exercises: parseInt(e.target.value) || 1 })
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
                      updateSettings({ ...settings, rounds: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/50 border border-white/30"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Additional Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-white/80 text-sm">
                  <div>Giữ màn hình sáng</div>
                  <div className="text-xs text-white/60">{getWakeStatus()}</div>
                </div>
                <button
                  onClick={() => updateKeepScreenOn(!keepScreenOn)}
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
                    onClick={() => speak("Work")}
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
                    onClick={() => updateSoundEnabled(!soundEnabled)}
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

            {/* Storage Info */}
            <div className="mt-4 p-2 bg-white/5 rounded-lg">
              <p className="text-white/60 text-xs">
                💾 Cài đặt được lưu tự động trong localStorage
              </p>
              <p className="text-white/60 text-xs">
                💡 Hỗ trợ Wake Lock API, Video fallback, và Interaction fallback
              </p>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="text-center mb-6">
          <div className="text-white/80 text-sm mb-2">
            {currentPhase === "roundRest" ? (
              <>
                Vòng {currentRound}/{settings.rounds} hoàn thành • Nghỉ giữa round
                {keepScreenOn && <span className="ml-2">{getWakeStatus()}</span>}
              </>
            ) : (
              <>
                Vòng {currentRound}/{settings.rounds} • Bài tập {currentExercise}/
                {settings.exercises}
                {keepScreenOn && <span className="ml-2">{getWakeStatus()}</span>}
              </>
            )}
          </div>
          <div
            className={`text-3xl font-bold mb-2 ${
              currentPhase === "work"
                ? "text-green-400"
                : currentPhase === "rest"
                ? "text-blue-400"
                : "text-purple-400"
            }`}
          >
            {currentPhase === "work" ? "WORK" : currentPhase === "rest" ? "REST" : "ROUND REST"}
          </div>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-8">
          <div
            className={`text-7xl font-mono font-bold ${
              currentPhase === "work"
                ? "text-green-400"
                : currentPhase === "rest"
                ? "text-blue-400"
                : "text-purple-400"
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
                currentPhase === "work"
                  ? "bg-green-400"
                  : currentPhase === "rest"
                  ? "bg-blue-400"
                  : "bg-purple-400"
              }`}
              style={{
                width: `${
                  (((currentPhase === "work"
                    ? settings.workTime
                    : currentPhase === "rest"
                    ? settings.restTime
                    : settings.roundRestTime) -
                    currentTime) /
                    (currentPhase === "work"
                      ? settings.workTime
                      : currentPhase === "rest"
                      ? settings.restTime
                      : settings.roundRestTime)) *
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
