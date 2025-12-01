"use client";

import { useSearchParams } from "next/navigation";
import Peer from "peerjs";
import { QRCodeCanvas } from "qrcode.react";
import { useState, useEffect, useRef } from "react";


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
      console.log("초대 링크로 입장:", inviteRoom);
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



  function TugGame({ conn, mySide }) {
    const [score, setScore] = useState(50);
    const scoreRef = useRef(score);
    const [time, setTime] = useState(10);
    const [winner, setWinner] = useState(null);
    const [animate, setAnimate] = useState(false);
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
              const newScore = Math.max(0, scoreRef.current - 1);
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
        const newScore = Math.min(100, scoreRef.current + 1);
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

      console.log("winner:", winner, "isHost:", isHost);
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
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 40,
          background: animate
            ? "linear-gradient(135deg, #a1aad0ff, #867597ff)"
            : "linear-gradient(135deg, #667eea, #764ba2)",
          color: "#fff",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          transition: "background 1s ease",
        }}
      >
        <h2 style={{ fontSize: 48, marginBottom: 20 }}>⏱ {time}s</h2>

        {/* 세로 줄 */}
        <div
          style={{
            position: "relative",
            width: 30,
            height: 300,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 15,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: -15,
              width: 60,
              height: 2,
              background: "#ffffff74",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "60%",
              left: -15,
              width: 60,
              height: 2,
              background: "#ffffff74",
              borderRadius: 2,
            }}
          />
          {/* 점수 동그라미 */}
          <div
            style={{
              position: "absolute",
              top: mySide === "host" ? `calc(${score}% - 15px)` : `calc(${100 - score}% - 15px)`,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "orange",
              transition: "top 0.1s linear",
            }}
          />
        </div>

        {!winner && (
          <button
            onClick={handleClick}
            style={{
              padding: "15px 30px",
              fontSize: 22,
              borderRadius: 12,
              border: "none",
              background: "#ff7e5f",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            }}
          >
            당기기!
          </button>
        )}

        {winner && (
          <>
            <h1 style={{ marginTop: 30, fontSize: 36 }}>{getResultText()}</h1>
            <button
              onClick={sendReset}
              style={{
                marginTop: 20,
                padding: "10px 20px",
                fontSize: 20,
                borderRadius: 10,
                border: "none",
                background: "#4ade80",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              🔄 재경기
            </button>
          </>
        )}
      </div>
    );
  }

  if (!ready) return null;

   if (!inGame)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #667eea, #764ba2)",
          color: "#fff",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          textAlign: "center",
          padding: "20px",
        }}
      >
        <h1 style={{ fontSize: "48px", marginBottom: "20px", textShadow: "2px 2px 8px rgba(0,0,0,0.3)" }}>
          🎮 1:1 Mini Game
        </h1>

        {isHost ? (
          <>
            <div
              style={{
                fontSize: "24px",
                padding: "20px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.1)",
                boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
              }}
            >
              방 ID: <span style={{ fontWeight: "bold", fontSize: "28px" }}>{myId}</span>
            </div>
            <button
              onClick={shareRoom}
              style={{
                padding: "10px 16px",
                margin : 20,
                fontSize: 16,
                background: "#2f80ed",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                marginTop: 10,
              }}
            >
      초대 링크 공유하기
    </button>
     <div
          style={{
            background: "#fff",
            padding: 10,
            borderRadius: 16,
            display: "flex",
            justifyContent: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            marginBottom: 20,
          }}
        >
          <QRCodeCanvas value={`${window.location.origin}?room=${myId}`} size={200} />
        </div>

    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
      QR 코드를 스캔하면 자동으로 참가됩니다!
    </p>
    </>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "15px",
              marginTop: "20px",
              width: "300px",
            }}
          >
            <button
              onClick={createRoom}
              style={{
                padding: "15px",
                fontSize: "18px",
                borderRadius: "10px",
                border: "none",
                background: "#ff7e5f",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                transition: "0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            >
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

            <button
              onClick={joinRoom}
              style={{
                padding: "15px",
                fontSize: "18px",
                borderRadius: "10px",
                border: "none",
                background: "#4ade80",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                transition: "0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            >
              방 참가
            </button>
          </div>
        )}

        <p style={{ marginTop: "40px", fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
          친구와 함께 즐겨보세요! 🕹️
        </p>
      </div>
    );
  return <TugGame conn={conn} mySide={(isHost) ? ("host"):("guest")} />;
}