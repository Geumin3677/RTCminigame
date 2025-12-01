import { useState, useEffect, useRef } from "react";

import gameStyles from './TugGame.module.css';

function TugGame({ conn, mySide }) {
    const [winner, setWinner] = useState(null);
    const [animate, setAnimate] = useState(false);

    const [score, setScore] = useState(50);
    const scoreRef = useRef(score);
    const [time, setTime] = useState(10);
    const timerRef = useRef(null);

    // ref 동기화
    useEffect(() => {
      scoreRef.current = score;
    }, [score]);

    // ---------------------------
    // Peer 데이터 수신
    // ---------------------------
    useEffect(() => {
      if (!conn) return;

      const handleData = (data) => {
        switch (data.type) {
          case "sync":
            setScore(data.score);
            break;
          case "click":
            if (mySide === "host") {
              const newScore = Math.max(0, scoreRef.current - 5);
              setScore(newScore);
              scoreRef.current = newScore;
              conn.send({ type: "sync", score: newScore });
            }
            break;
          case "end":
            setWinner(data.winner);
            setAnimate(true);
            break;
          case "reset":
            resetLocal();
            break;
        }
      };

      conn.on("data", handleData);
      return () => conn.off("data", handleData);
    }, [conn, mySide]);

    // ---------------------------
    // 타이머
    // ---------------------------
    useEffect(() => {
      if (winner) return;

      timerRef.current = setInterval(() => {
        setTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timerRef.current);
    }, [winner]);

    // ---------------------------
    // 클릭 처리
    // ---------------------------
    const handleClick = () => {
      if (!conn || winner) return;

      if (mySide === "host") {
        const newScore = Math.min(100, scoreRef.current + 5);
        setScore(newScore);
        scoreRef.current = newScore;
        conn.send({ type: "sync", score: newScore });
      } else {
        conn.send({ type: "click" });
      }
    };

    // ---------------------------
    // 게임 종료
    // ---------------------------
    const finishGame = () => {
      let result = null;
      if (scoreRef.current <= 40) result = "guest";
      else if (scoreRef.current >= 60) result = "host";
      else result = "draw";

      setWinner(result);
      setAnimate(true);
      conn.send({ type: "end", winner: result });
    };

    // ---------------------------
    // 재경기
    // ---------------------------
    const resetLocal = () => {
      clearInterval(timerRef.current);
      setScore(50);
      scoreRef.current = 50;
      setTime(10);
      setWinner(null);
      setAnimate(false);
    };

    const sendReset = () => {
      resetLocal();
      conn.send({ type: "reset" });
    };

    // ---------------------------
    // 승리 텍스트
    // ---------------------------
    const getResultText = () => {
      if (!winner) return "";
      if (winner === "host") return isHost ? "승리!" : "패배";
      if (winner === "guest") return isHost ? "패배" : "승리!";
      return "무승부";
    };

    // ---------------------------
    // UI
    // ---------------------------
    return (
    <div
      className={gameStyles.container}
      style={{
        background: animate
          ? "linear-gradient(135deg, #a1aad0ff, #867597ff)"
          : "linear-gradient(135deg, #667eea, #764ba2)",
      }}
    >
      <h2 className={gameStyles.timer}>⏱ {time}s</h2>

      <div className={gameStyles.verticalLine}>
        <div className={gameStyles.lineMarker} style={{ top: "40%" }} />
        <div className={gameStyles.lineMarker} style={{ top: "60%" }} />

        <div
          className={gameStyles.circle}
          style={{
            top: mySide === "host" ? `calc(${score}% - 15px)` : `calc(${100 - score}% - 15px)`,
          }}
        />
      </div>

      {!winner && <button className={gameStyles.pullButton} onClick={handleClick}>당기기!</button>}

      {winner && (
        <>
          <h1 className={gameStyles.resultText}>{getResultText()}</h1>
          <button className={gameStyles.resetButton} onClick={sendReset}>🔄 재경기</button>
        </>
      )}
    </div>
  );
  }

  export default TugGame;