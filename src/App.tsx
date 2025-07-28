import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import { textSetsData, TextSet } from './textSets';

const GENKOU_ROWS = 15;
const GENKOU_COLS = 15;

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  visible: boolean;
  lifetime: number;
  selected: boolean;
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isKutenOrTouten(ch: string) {
  return ch === '。' || ch === '、' || ch === '，' || ch === '．' || ch === ',' || ch === '.';
}

function getKutenPosition(col: number, row: number) {
  const cellSize = 30;
  const colSpacing = 6;
  // ブラウザ間の互換性を向上させるため、より正確な位置計算
  const baseX = col * (cellSize + colSpacing);
  const baseY = row * cellSize;
  
  // 縦書き時の句読点位置をマスの右上により配置（更に微調整）
  return { 
    x: baseX + (cellSize * 0.85),  // セルの右側85%の位置（より右寄り）
    y: baseY + (cellSize * 0.15)   // セルの上側15%の位置（より上寄り）
  };
}

const App: React.FC = () => {
  // Text set management
  const [currentTextSet, setCurrentTextSet] = useState<TextSet>(textSetsData.textSets[0]);
  const [textSets] = useState<TextSet[]>(textSetsData.textSets);
  
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
  const [genkou, setGenkou] = useState<string[][]>(
    Array(GENKOU_COLS).fill('').map(() => Array(GENKOU_ROWS).fill(''))
  );
  const [kutenMap, setKutenMap] = useState<{ col: number; row: number; char: string }[]>([]);
  const [nextCell, setNextCell] = useState({ col: GENKOU_COLS - 1, row: 0 });
  const [hoveredText, setHoveredText] = useState<FloatingText | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // ページタイトルを設定
  useEffect(() => {
    document.title = '筆跡';
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    let idRef = { current: 0 };
    let timers: ReturnType<typeof setTimeout>[] = [];
    let isActive = true;
    
    const spawnText = () => {
      if (!isActive) return;
      
      setFloatingTexts((prev) => {
        const available = currentTextSet.texts.filter(t => !selectedTextIds.has(t));
        if (available.length === 0) return prev;
        
        // 現在表示中のテキストを除外
        const showing = prev.filter(ft => !ft.selected && ft.visible).map(ft => ft.text);
        const candidates = available.filter(t => !showing.includes(t));
        if (candidates.length === 0) return prev;
        
        const fontSize = getRandomInt(20, 32);
        const text = candidates[getRandomInt(0, candidates.length - 1)];
        
        const estimatedTextHeight = text.length * fontSize * 0.8;
        // パディングを考慮した利用可能高さ（上部200px + 下部40px = 240px）
        const availableHeight = containerSize.height - 240;
        
        const lines: string[] = [];
        if (estimatedTextHeight <= availableHeight) {
          lines.push(text);
        } else {
          const maxTextLen = Math.floor(availableHeight / fontSize);
          for (let i = 0; i < text.length; i += maxTextLen) {
            lines.push(text.slice(i, i + maxTextLen));
          }
        }
        
        const textWidth = lines.length * fontSize * 1.2;
        const textHeight = text.length * fontSize;
        const minX = 60;
        // 右側のボタンエリア（約250px）を避けるため、maxXをより制限的に設定
        const buttonAreaWidth = 250; // ボタンエリアの幅
        const maxX = Math.max(120, containerSize.width - textWidth - buttonAreaWidth);
        const minY = 200; // 上部のボタンエリアも避ける
        const maxY = Math.max(minY + 100, containerSize.height - textHeight - 60);
        
        let x = 0, y = 0, tryCount = 0, overlap = false;
        do {
          x = getRandomInt(minX, maxX);
          y = getRandomInt(minY, maxY);
          overlap = prev.some(ft => {
            if (ft.selected || !ft.visible) return false;
            const ftEstimatedHeight = ft.text.length * ft.fontSize * 0.8;
            // パディングを考慮した利用可能高さ
            const ftAvailableHeight = containerSize.height - 240;
            const ftLines: string[] = [];
            if (ftEstimatedHeight <= ftAvailableHeight) {
              ftLines.push(ft.text);
            } else {
              const maxFtTextLen = Math.floor(ftAvailableHeight / ft.fontSize);
              for (let i = 0; i < ft.text.length; i += maxFtTextLen) {
                ftLines.push(ft.text.slice(i, i + maxFtTextLen));
              }
            }
            const ftTextWidth = ftLines.length * ft.fontSize * 1.2;
            const ftTextHeight = ft.text.length * ft.fontSize;
            const margin = 60; // Firefoxでの重複を防ぐためマージンを大きく
            return (
              x < ft.x + ftTextWidth + margin &&
              x + textWidth + margin > ft.x &&
              y < ft.y + ftTextHeight + margin &&
              y + textHeight + margin > ft.y
            );
          });
          tryCount++;
        } while (overlap && tryCount < 300); // 試行回数をさらに増加
        
        const lifetime = getRandomInt(3000, 4000); // 少し長めに
        const newId = idRef.current++;
        
        const fadeOutTimer = setTimeout(() => {
          if (!isActive) return;
          setFloatingTexts((prev2) => prev2.map((ft) => 
            ft.id === newId ? { ...ft, visible: false } : ft
          ));
          setHoveredText((current) => current?.id === newId ? null : current);
        }, lifetime);
        
        const removeTimer = setTimeout(() => {
          if (!isActive) return;
          setFloatingTexts((prev2) => prev2.filter((ft) => ft.id !== newId));
          setHoveredText((current) => current?.id === newId ? null : current);
        }, lifetime + 700);
        
        timers.push(fadeOutTimer, removeTimer);
        
        return [
          ...prev,
          {
            id: newId,
            text,
            x,
            y,
            fontSize,
            visible: true,
            lifetime,
            selected: false,
          },
        ];
      });
      
      if (isActive) {
        const nextSpawnTimer = setTimeout(() => {
          if (isActive) spawnText();
        }, getRandomInt(1500, 2500)); // 間隔を少し長めに
        timers.push(nextSpawnTimer);
      }
    };
    
    const initialTimer = setTimeout(() => {
      if (isActive) spawnText();
    }, 500);
    timers.push(initialTimer);
    
    return () => {
      isActive = false;
      timers.forEach(clearTimeout);
    };
  }, [containerSize.width, containerSize.height, selectedTextIds]);

  const handleTextClick = (t: FloatingText) => {
    console.log('テキストがクリックされました:', t.text);
    
    if (t.selected) {
      console.log('既に選択済みのテキストです');
      return;
    }
    
    // ホバー状態をクリア
    setHoveredText((current) => current?.id === t.id ? null : current);
    
    // 原稿用紙に文字を配置
    setGenkou((prev) => {
      console.log('原稿用紙に文字を配置中:', t.text);
      const newGenkou = prev.map((col) => [...col]);
      let { col, row } = nextCell;
      let newKutenMap: { col: number; row: number; char: string }[] = [];
      
      console.log('開始位置:', { col, row });
      
      for (let i = 0; i < t.text.length; i++) {
        if (row >= GENKOU_ROWS) {
          col--;
          row = 0;
        }
        if (col < 0) {
          console.log('原稿用紙の容量が不足しました');
          break;
        }
        
        const char = t.text[i];
        if (isKutenOrTouten(char)) {
          newKutenMap.push({ col, row, char });
          console.log('句読点を配置:', { col, row, char });
        } else {
          newGenkou[col][row] = char;
          console.log('文字を配置:', { col, row, char });
        }
        row++;
      }
      
      // 句読点マップを更新
      setKutenMap((prevKuten) => {
        const updated = [...prevKuten, ...newKutenMap];
        console.log('句読点マップ更新:', updated);
        return updated;
      });
      
      console.log('原稿用紙更新完了');
      return newGenkou;
    });
    
    // 次の配置位置を更新
    setNextCell((prev) => {
      let { col, row } = prev;
      let consume = t.text.length;
      row += consume;
      while (row >= GENKOU_ROWS) {
        row -= GENKOU_ROWS;
        col--;
      }
      if (col < 0) {
        console.log('原稿用紙が満杯になりました');
        return { col: 0, row: GENKOU_ROWS - 1 };
      }
      const newPos = { col, row };
      console.log('次の配置位置:', newPos);
      return newPos;
    });
    
    // テキストを選択済みにマーク
    setFloatingTexts((prev) => {
      const updated = prev.map((ft) => ft.id === t.id ? { ...ft, selected: true, visible: false } : ft);
      console.log('浮遊テキスト更新:', updated.filter(ft => ft.selected).map(ft => ft.text));
      return updated;
    });
    
    // 選択済みテキストIDを追加
    setSelectedTextIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(t.text);
      console.log('選択済みテキスト更新:', Array.from(newSet));
      return newSet;
    });
  };

  const handleReset = () => {
    console.log('リセットを開始します');
    
    // すべての状態を初期化
    setGenkou(Array(GENKOU_COLS).fill('').map(() => Array(GENKOU_ROWS).fill('')));
    setNextCell({ col: GENKOU_COLS - 1, row: 0 });
    setSelectedTextIds(new Set());
    setKutenMap([]);
    setHoveredText(null);
    setFloatingTexts([]);
    
    console.log('リセット完了');
  };

  const handleDownloadImage = () => {
    try {
      console.log('画像保存を開始します');
      
      const svgElement = document.querySelector('.manuscript-svg') as SVGElement;
      if (!svgElement) {
        console.error('SVG要素が見つかりません');
        alert('SVG要素が見つかりません。しばらく待ってから再試行してください。');
        return;
      }

      // SVGのサイズを取得
      const svgWidth = (GENKOU_COLS * 30) + ((GENKOU_COLS - 1) * 6);
      const svgHeight = GENKOU_ROWS * 30;
      const padding = 40;
      
      // Canvasを作成
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Canvas contextが取得できません');
        alert('Canvas contextが取得できません');
        return;
      }

      // 高解像度で出力（2倍サイズ）
      const scale = 2;
      const totalWidth = svgWidth + (padding * 2);
      const totalHeight = svgHeight + (padding * 2);
      
      canvas.width = totalWidth * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);

      // 原稿用紙の背景色を設定
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // 原稿用紙の枠線を描画
      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, totalWidth - 2, totalHeight - 2);

      // 左上の小さな装飾を描画
      ctx.fillStyle = '#8b7355';
      ctx.fillRect(15, 20, 8, 6);

      // 右下の「15×15」テキストを描画
      ctx.fillStyle = '#5a4a3a';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('15×15', totalWidth - 10, totalHeight - 8);

      // マス目を描画
      ctx.strokeStyle = '#6b5b4f';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;
      
      for (let r = 0; r < GENKOU_ROWS; r++) {
        for (let c = 0; c < GENKOU_COLS; c++) {
          const x = padding + c * (30 + 6);
          const y = padding + r * 30;
          ctx.strokeRect(x, y, 30, 30);
        }
      }
      
      ctx.globalAlpha = 1.0;

      // 文字を描画
      ctx.fillStyle = '#3b2c1a';
      ctx.font = '20px "Yu Mincho", serif';
      ctx.textAlign = 'center';
      
      // 通常の文字を描画
      genkou.forEach((col, c) => {
        col.forEach((ch, r) => {
          if (ch) {
            const x = padding + c * (30 + 6) + 15;
            const y = padding + r * 30 + 20;
            ctx.fillText(ch, x, y);
          }
        });
      });

      // 句読点を描画
      ctx.font = '14px "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      kutenMap.forEach(({ col, row, char }) => {
        const pos = getKutenPosition(col, row);
        const x = padding + pos.x;
        const y = padding + pos.y;
        ctx.fillText(char, x, y);
      });

      // PNG画像としてダウンロード
      canvas.toBlob((blob) => {
        if (blob) {
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `原稿_${new Date().toISOString().slice(0, 10)}.png`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          console.log('画像保存が完了しました');
        } else {
          console.error('Blobの作成に失敗しました');
          alert('画像の作成に失敗しました');
        }
      }, 'image/png');

    } catch (error) {
      console.error('画像保存エラー:', error);
      alert('画像保存エラー: ' + error);
    }
  };

  const getPreviewData = useCallback((text: FloatingText) => {
    const { col, row } = nextCell;
    const previewGenkou: string[][] = Array(GENKOU_COLS).fill('').map(() => Array(GENKOU_ROWS).fill(''));
    const previewKuten: { col: number; row: number; char: string }[] = [];
    
    let currentCol = col;
    let currentRow = row;
    
    for (let i = 0; i < text.text.length; i++) {
      if (currentRow >= GENKOU_ROWS) {
        currentCol--;
        currentRow = 0;
      }
      if (currentCol < 0) break;
      
      if (isKutenOrTouten(text.text[i])) {
        previewKuten.push({ col: currentCol, row: currentRow, char: text.text[i] });
        currentRow++;
      } else {
        previewGenkou[currentCol][currentRow] = text.text[i];
        currentRow++;
      }
    }
    
    return { previewGenkou, previewKuten };
  }, [nextCell]);

  const previewData = useMemo(() => {
    if (!hoveredText) return null;
    return getPreviewData(hoveredText);
  }, [hoveredText, getPreviewData]);
  const handleMouseEnter = useCallback((text: FloatingText) => {
    if (!text.visible || text.selected) return;
    setHoveredText(text);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredText(null);
  }, []);

  return (
    <div style={{ minHeight: '100vh', width: '100vw', position: 'relative', overflow: 'auto' }}>
      {/* テキストセット選択 */}
      <div 
        style={{ 
          position: 'fixed', 
          top: 24, 
          right: 32, 
          zIndex: 100,
          backgroundColor: '#fff3e0',
          border: '2px solid #a85c2c',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          minWidth: '200px'
        }}
      >
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#6b5b4f', fontWeight: 'bold' }}>
          文章セット
        </div>
        <select
          value={currentTextSet.id}
          onChange={(e) => {
            const selectedSet = textSets.find(set => set.id === e.target.value);
            if (selectedSet) {
              setCurrentTextSet(selectedSet);
              // テキストセットが変更されたときは全体をリセット
              handleReset();
            }
          }}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid #a85c2c',
            backgroundColor: 'white',
            fontSize: '12px',
            color: '#3b2c1a'
          }}
        >
          {textSets.map(set => (
            <option key={set.id} value={set.id}>
              {set.title}
            </option>
          ))}
        </select>
      </div>
      
      <button 
        className="taisho-btn taisho-reset" 
        style={{ 
          position: 'fixed', 
          top: '116px',  // 完全に均等な間隔のために調整
          right: '32px', 
          zIndex: 100,
          backgroundColor: '#fff3e0',  // 元の色に戻す
          color: '#d13c2f',            // 元の色に戻す
          border: '2px solid #d13c2f', // 元の色に戻す
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease',
          marginBottom: '12px'  // ボタン間の余白を均等に調整
        }} 
        onClick={handleReset}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#d13c2f';
          e.currentTarget.style.color = '#fff3e0';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#fff3e0';
          e.currentTarget.style.color = '#d13c2f';
        }}
      >
        リセット
      </button>
      
      <button 
        className="taisho-btn" 
        style={{ 
          position: 'fixed', 
          top: '174px',  // 完全に均等な間隔（58px間隔）
          right: '32px', 
          zIndex: 100,
          backgroundColor: '#a85c2c',
          color: 'white',
          border: '2px solid #8b4513',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease'
        }} 
        onClick={handleDownloadImage}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#8b4513';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#a85c2c';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        画像保存
      </button>
      
      <Link 
        to="/about"
        style={{ 
          position: 'fixed', 
          top: 24, 
          left: 32, 
          zIndex: 100,
          textDecoration: 'none'
        }}
      >
        <button 
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
          このサイトについて
        </button>
      </Link>

      {/* 現在のセット情報表示 */}
      <div
        style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          backgroundColor: '#fff3e0',
          border: '2px solid #a85c2c',
          borderRadius: '8px',
          padding: '8px 16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b2c1a' }}>
          {currentTextSet.title}
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        width: '100vw', 
        maxWidth: 'none', 
        margin: '0', 
        minHeight: '80vh', 
        alignItems: 'flex-end', 
        justifyContent: 'flex-start' 
      }}>
        {/* 左側：原稿用紙 */}
        <div 
          className="taisho-paper" 
          style={{ 
            position: 'relative', 
            writingMode: 'vertical-rl', 
            textOrientation: 'upright', 
            marginLeft: '38px', 
            marginRight: '20px', 
            maxWidth: 700, 
            width: '45%', 
            minWidth: 320, 
            height: '80vh', 
            overflow: 'auto', 
            background: '#f5f0e8', 
            alignSelf: 'flex-end', 
            bottom: '-100px', 
            border: '2px solid #8b7355', 
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', 
            padding: '20px',
            flexShrink: 0
          }}
        >
          <div style={{
            position: 'absolute',
            top: '15px',
            left: '10px',
            width: '8px',
            height: '6px',
            backgroundColor: '#8b7355',
            borderRadius: '2px',
            zIndex: 10,
          }} />
          
          <div style={{
            position: 'absolute',
            bottom: '5px',
            right: '8px',
            fontSize: '10px',
            color: '#5a4a3a',
            fontFamily: 'monospace',
            zIndex: 10,
            writingMode: 'horizontal-tb',
            textOrientation: 'mixed',
          }}>
            15×15
          </div>

          <svg 
            className="manuscript-svg"
            width="100%" 
            height={GENKOU_ROWS * 30} 
            viewBox={'0 0 ' + ((GENKOU_COLS * 30) + ((GENKOU_COLS - 1) * 6)) + ' ' + (GENKOU_ROWS * 30)} 
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            {[...Array(GENKOU_ROWS)].map((_, r) => (
              [...Array(GENKOU_COLS)].map((_, c) => {
                const x = c * (30 + 6);
                const y = r * 30;
                return (
                  <rect
                    key={'cell-' + r + '-' + c}
                    x={x}
                    y={y}
                    width={30}
                    height={30}
                    fill="none"
                    stroke="#6b5b4f"
                    strokeWidth="1"
                    opacity="0.8"
                  />
                );
              })
            ))}
            
            {previewData && (
              <>
                {previewData.previewGenkou.map((col, c) =>
                  col.map((ch, r) =>
                    ch ? (
                      <text
                        key={'preview-t' + c + '-' + r}
                        x={c * (30 + 6) + 15}
                        y={r * 30 + 20}
                        fontSize={20}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#a85c2c"
                        opacity="0.3"
                        style={{ 
                          fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif',
                          writingMode: 'vertical-rl', 
                          textOrientation: 'upright',
                          userSelect: 'none'
                        }}
                      >
                        {ch}
                      </text>
                    ) : null
                  )
                )}
                {previewData.previewKuten.map(({ col, row, char }, idx) => (
                  <text
                    key={'preview-kuten-' + col + '-' + row + '-' + idx}
                    x={getKutenPosition(col, row).x}
                    y={getKutenPosition(col, row).y}
                    fontSize={14}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#a85c2c"
                    opacity="0.3"
                    style={{ 
                      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif',
                      writingMode: 'horizontal-tb',
                      textOrientation: 'mixed'
                    }}
                  >
                    {char}
                  </text>
                ))}
              </>
            )}
            
            {genkou.map((col, c) =>
              col.map((ch, r) =>
                ch ? (
                  <text
                    key={'t' + c + '-' + r}
                    x={c * (30 + 6) + 15}
                    y={r * 30 + 20}
                    fontSize={20}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#3b2c1a"
                    style={{ 
                      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif',
                      writingMode: 'vertical-rl', 
                      textOrientation: 'upright',
                      userSelect: 'none'
                    }}
                  >
                    {ch}
                  </text>
                ) : null
              )
            )}
            
            {kutenMap.map(({ col, row, char }, idx) => (
              <text
                key={'kuten-' + col + '-' + row + '-' + idx}
                x={getKutenPosition(col, row).x}
                y={getKutenPosition(col, row).y}
                fontSize={14}  // サイズを少し小さく
                textAnchor="middle"
                dominantBaseline="central"  // ブラウザ間でのベースライン統一
                fill="#3b2c1a"
                style={{ 
                  fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif',
                  writingMode: 'horizontal-tb',  // 句読点は横書きモードで統一
                  textOrientation: 'mixed'
                }}
              >
                {char}
              </text>
            ))}
          </svg>
        </div>

        {/* 右側：浮遊テキスト */}
        <div 
          ref={containerRef}
          style={{ 
            position: 'relative', 
            width: '55%', 
            minWidth: 320, 
            height: '80vh', 
            minHeight: 400, 
            overflow: 'visible', 
            background: 'none', 
            paddingTop: '200px', // 上部のボタンエリアを避ける
            paddingRight: '250px', // 右側のボタンエリアを避ける
            paddingBottom: '40px', 
            paddingLeft: '20px',
            flexGrow: 1
          }}
        >
          {floatingTexts.filter(t => !t.selected && t.visible).map((t) => {
            const fontSize = t.fontSize;
            const estimatedTextHeight = t.text.length * fontSize * 0.8;
            // パディングを考慮した利用可能高さ
            const availableHeight = containerSize.height - 240;
            
            const lines: string[] = [];
            if (estimatedTextHeight <= availableHeight) {
              lines.push(t.text);
            } else {
              const maxTextLen = Math.floor(availableHeight / fontSize);
              for (let i = 0; i < t.text.length; i += maxTextLen) {
                lines.push(t.text.slice(i, i + maxTextLen));
              }
            }
            
            return (
              <span
                key={t.id}
                className="taisho-floating-text"
                style={{
                  position: 'absolute',
                  left: t.x,
                  top: t.y,
                  fontSize: t.fontSize,
                  opacity: t.visible ? 1 : 0,
                  zIndex: 10,
                  transition: 'opacity 0.7s, transform 0.7s',
                  transform: t.visible ? 'scale(1)' : 'scale(0.7)',
                  color: '#a85c2c',
                  textShadow: '1px 1px 0 #fff3e0',
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright',
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  maxWidth: 'none',
                  width: 'auto',
                  height: 'auto',
                  wordBreak: 'keep-all',
                  pointerEvents: (t.selected || !t.visible) ? 'none' : 'auto',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  gap: '0px',
                  cursor: 'pointer',
                }}
                onClick={() => handleTextClick(t)}
                onMouseEnter={() => handleMouseEnter(t)}
                onMouseLeave={handleMouseLeave}
              >
                {lines.map((line, idx) => (
                  <span key={idx} style={{ display: 'inline-block' }}>{line}</span>
                ))}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;
