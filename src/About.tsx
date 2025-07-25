import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const About: React.FC = () => {
  useEffect(() => {
    document.title = 'このサイトについて - 筆跡';
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh', 
      width: '100vw', 
      position: 'relative', 
      overflow: 'auto',
      padding: '40px',
      backgroundColor: '#f9f7f4'
    }}>
      {/* ナビゲーションボタン */}
      <Link 
        to="/"
        style={{ 
          position: 'fixed', 
          top: 24, 
          left: 32, 
          zIndex: 100,
          textDecoration: 'none'
        }}
      >
        <button 
          className="taisho-btn"
          style={{
            backgroundColor: '#8b7355',
            color: 'white',
            border: '2px solid #6b5b4f',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#6b5b4f';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#8b7355';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ← 原稿に戻る
        </button>
      </Link>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        paddingTop: '80px'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          color: '#3b2c1a',
          textAlign: 'center',
          marginBottom: '40px',
          fontFamily: 'Yu Mincho, serif'
        }}>
          筆跡について
        </h1>

        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          lineHeight: '1.8',
          fontSize: '16px',
          color: '#3b2c1a'
        }}>
          <h2 style={{ 
            color: '#8b7355',
            borderBottom: '2px solid #8b7355',
            paddingBottom: '8px',
            marginBottom: '24px'
          }}>
            このサイトについて
          </h2>
          
          <p style={{ marginBottom: '20px' }}>
            このサイトは、小説を書くという体験を直観的に味わうためのサイトです．
            浮かび上がってくる文章をクリックして，自由に文章の順番を組み合わせることで，自分なりの小説を書くことができます．
            あなたも，自分だけのとっておきの小説を書いてみませんか？
          </p>

        

          <h3 style={{ 
            color: '#8b7355',
            marginTop: '32px',
            marginBottom: '16px'
          }}>
            使い方
          </h3>
          <ol style={{ 
            paddingLeft: '20px',
            marginBottom: '24px'
          }}>
            <li style={{ marginBottom: '8px' }}>右側に表示される浮遊テキストをクリック</li>
            <li style={{ marginBottom: '8px' }}>文字が原稿用紙に自動的に配置されます</li>
            <li style={{ marginBottom: '8px' }}>ホバーすると配置位置をプレビューできます</li>
            <li style={{ marginBottom: '8px' }}>「リセット」ボタンで初期状態に戻せます</li>
          </ol>

        

          <div style={{
            marginTop: '40px',
            padding: '20px',
            backgroundColor: '#f5f0e8',
            borderRadius: '8px',
            borderLeft: '4px solid #8b7355'
          }}>
            <p style={{ 
              margin: '0',
              fontStyle: 'italic',
              color: '#6b5b4f'
            }}>
              作成者： 中原麻結
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
