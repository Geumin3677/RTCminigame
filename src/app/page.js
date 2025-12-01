"use client";

import { useSearchParams } from "next/navigation";
import Peer from "peerjs";
import { QRCodeCanvas } from "qrcode.react";
import { useState, useEffect, useRef } from "react";

import styles from "./Home.module.css";
import TugGame from "./tugGame";

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