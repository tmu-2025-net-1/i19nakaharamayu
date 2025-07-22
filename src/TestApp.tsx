import React from 'react';

const TestApp: React.FC = () => {
  console.log('TestApp is rendering');
  
  return (
    <div style={{ 
      background: 'red', 
      color: 'white', 
      padding: '20px',
      margin: '20px',
      fontSize: '24px'
    }}>
      <h1>テストアプリ</h1>
      <p>この画面が見えたら、基本的なReactは動作しています。</p>
    </div>
  );
};

export default TestApp;
