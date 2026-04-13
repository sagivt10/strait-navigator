import { useState, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import LevelSelect from './components/LevelSelect';
import LevelIntro from './components/LevelIntro';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import DailyGame from './components/DailyGame';
import DailyLeaderboard from './components/DailyLeaderboard';
import { getLevelById, allLevelsMeta } from './levels/index';

const SCREENS = {
  LANDING: 'landing',
  LEVEL_SELECT: 'level_select',
  LEVEL_INTRO: 'level_intro',
  GAME: 'game',
  LEADERBOARD: 'leaderboard',
  DAILY: 'daily',
  DAILY_LEADERBOARD: 'daily_leaderboard',
};

function App() {
  const [screen, setScreen] = useState(SCREENS.LANDING);
  const [currentLevelId, setCurrentLevelId] = useState(null);

  const goToLevelSelect = useCallback(() => {
    setScreen(SCREENS.LEVEL_SELECT);
  }, []);

  const goToLanding = useCallback(() => {
    setScreen(SCREENS.LANDING);
  }, []);

  const startLevel = useCallback((levelId) => {
    setCurrentLevelId(levelId);
    setScreen(SCREENS.LEVEL_INTRO);
  }, []);

  const onIntroComplete = useCallback(() => {
    setScreen(SCREENS.GAME);
  }, []);

  const goToNextLevel = useCallback(() => {
    const nextId = currentLevelId + 1;
    const nextLevel = getLevelById(nextId);
    if (nextLevel) {
      setCurrentLevelId(nextId);
      setScreen(SCREENS.LEVEL_INTRO);
    } else {
      setScreen(SCREENS.LEVEL_SELECT);
    }
  }, [currentLevelId]);

  const goToLeaderboard = useCallback(() => {
    setScreen(SCREENS.LEADERBOARD);
  }, []);

  const goToDaily = useCallback(() => {
    setScreen(SCREENS.DAILY);
  }, []);

  const goToDailyLeaderboard = useCallback(() => {
    setScreen(SCREENS.DAILY_LEADERBOARD);
  }, []);

  const currentLevel = currentLevelId ? getLevelById(currentLevelId) : null;
  const currentMeta = currentLevelId
    ? allLevelsMeta.find((m) => m.id === currentLevelId)
    : null;
  const hasNextLevel = currentLevelId ? getLevelById(currentLevelId + 1) !== null : false;

  return (
    <>
      {screen === SCREENS.LANDING && (
        <LandingPage onStart={goToLevelSelect} onDaily={goToDaily} />
      )}

      {screen === SCREENS.LEVEL_SELECT && (
        <LevelSelect
          onSelectLevel={startLevel}
          onBack={goToLanding}
          onLeaderboard={goToLeaderboard}
          onDaily={goToDaily}
        />
      )}

      {screen === SCREENS.LEVEL_INTRO && currentMeta && (
        <LevelIntro levelMeta={currentMeta} onComplete={onIntroComplete} />
      )}

      {screen === SCREENS.GAME && currentLevel && (
        <Game
          key={currentLevelId}
          level={currentLevel}
          onLevelSelect={goToLevelSelect}
          onNextLevel={goToNextLevel}
          onLeaderboard={goToLeaderboard}
          hasNextLevel={hasNextLevel}
        />
      )}

      {screen === SCREENS.LEADERBOARD && (
        <Leaderboard
          initialLevelId={currentLevelId || 1}
          onBack={goToLevelSelect}
        />
      )}

      {screen === SCREENS.DAILY && (
        <DailyGame
          key="daily"
          onBack={goToLevelSelect}
          onDailyLeaderboard={goToDailyLeaderboard}
        />
      )}

      {screen === SCREENS.DAILY_LEADERBOARD && (
        <DailyLeaderboard onBack={goToDaily} />
      )}
    </>
  );
}

export default App;
