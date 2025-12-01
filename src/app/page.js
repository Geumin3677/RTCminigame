"use client";

import { useSearchParams } from "next/navigation";
import Peer from "peerjs";
import { QRCodeCanvas } from "qrcode.react";
import { useState, useEffect, useRef } from "react";

import styles from "./Home.module.css";
import gameStyles from './TugGame.module.css';

export default function Home() {
  const [ready, setReady] = useState(false);
  const [isHost, setHost] = useState(false);
  const [myId, setMyId] = useState(String(Math.random()).slice(2, 8));
  const [inGame, setInGame] = useState(false);
  const [conn, setConn] = useState(null);

  const peerRef = useRef(null);

  const searchParams = useSearchParams();
  const inviteRoom = searchParams.get("room");

  useEffect(() => {
    const peer = new Peer(myId, { reliable: true });

    peer.on("open", (id) => {
      console.log("Peer 준비 완료! 내 ID:", id);
      setMyId(id);
      setReady(true);
      if (inviteRoom) {
      autoJoinRoom(inviteRoom);
    }
    });

    peer.on("error", (err) => console.error("PeerJS 에러:", err));

    // Host 연결 리스너
    peer.on("connection", (connection) => {
      setConn(connection);
      connection.on("open", () => setInGame(true));
    });

    peerRef.current = peer;

    return () => peer.destroy();
  }, []);

  function createRoom() {
    setHost(true);
  }

  async function joinRoom() {
    const peer = peerRef.current;
    if (!peer) return;

    const compId = document.querySelector(".compId").value;
    if (!compId) return alert("방 번호 입력하세요");

    const connection = await peer.connect(compId, { reliable: true });

    connection.on("open", () => setInGame(true));
    setConn(connection);
  }

  async function autoJoinRoom(id) { 
    const peer = peerRef.current;
    if (!peer) return;

    const shouldJoin = window.confirm(`방 ${id}에 참가하시겠어요?`);
    if (shouldJoin) {
      const connection = await peer.connect(id, { reliable: true });

      connection.on("open", () => setInGame(true));
      setConn(connection);
    }
  }

  function shareRoom() {
    const url = `${window.location.origin}?room=${myId}`;

  // 브라우저가 Web Share API 지원하면 (모바일 위주)
    if (navigator.share) {
      navigator
        .share({
          title: "1:1 실시간 게임 초대",
          text: "게임 같이 해!",
          url: url,
        })
        .catch((err) => console.log("공유 취소됨:", err));
    } else {
      // 데스크탑 등은 복사 방식
      navigator.clipboard.writeText(url);
      alert("초대 링크가 복사되었습니다!\n친구에게 보내세요: " + url);
    }
  }

// -----------RoomManagement------------

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

  if (!ready) return null;

  if (!inGame)
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🎮 1:1 Mini Game</h1>

      {isHost ? (
        <>
          <div className={styles.hostCard}>
            방 ID: <span className={styles.hostId}>{myId}</span>
          </div>

          <button className={styles.shareButton} onClick={shareRoom}>
            초대 링크 공유하기
          </button>

          <div className={styles.qrWrapper}>
            <QRCodeCanvas value={`${window.location.origin}?room=${myId}`} size={200} />
          </div>

          <p className={styles.infoText}>
            QR 코드를 스캔하면 자동으로 참가됩니다!
          </p>
        </>
      ) : (
        <div className={styles.guestWrapper}>
          <button className={`${styles.guestButton} ${styles.create}`} onClick={createRoom}>
            방 생성
          </button>

          <input
            className="compId"
            placeholder="방 번호 입력"
            style={{
              padding: "12px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "none",
              outline: "none",
              textAlign: "center",
            }}
          />

          <button className={`${styles.guestButton} ${styles.join}`} onClick={joinRoom}>
            방 참가
          </button>
        </div>
      )}

      <p className={styles.infoText}>친구와 함께 즐겨보세요! 🕹️</p>
    </div>
  );
  return <TugGame conn={conn} mySide={(isHost) ? ("host"):("guest")} />;
}