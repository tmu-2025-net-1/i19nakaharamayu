import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './App.css';

const TEXT_CANDIDATES = [
  '彼は一度も私と目を合わせようとしない。',
  '右往左往にさまよう瞳すら見られない。',
  'ただの背中は一体何を私に教えてくれるのだろうか。',
  'ただだるそうに棒アイスを口に咥えながらスマホを眺めてた。',
  'ねぇ。何したらこっち見てくれる？',
];

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
  return { x: col * (cellSize + colSpacing) + cellSize - 5, y: row * cellSize + 8 };
}

const App: React.FC = () => {
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
    
    const spawnText = () => {
      setFloatingTexts((prev) => {
        const available = TEXT_CANDIDATES.filter(t => !selectedTextIds.has(t));
        if (available.length === 0) return prev;
        
        const showing = prev.filter(ft => !ft.selected).map(ft => ft.text);
        const candidates = available.filter(t => !showing.includes(t));
        if (candidates.length === 0) return prev;
        
        const fontSize = getRandomInt(20, 32);
        const text = candidates[getRandomInt(0, candidates.length - 1)];
        
        const estimatedTextHeight = text.length * fontSize * 0.8;
        const availableHeight = containerSize.height - 80 - 60;
        
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
        const maxX = Math.max(120, containerSize.width - textWidth - 120);
        const minY = 80;
        const maxY = Math.max(minY + 100, containerSize.height - textHeight - 60);
        
        let x = 0, y = 0, tryCount = 0, overlap = false;
        do {
          x = getRandomInt(minX, maxX);
          y = getRandomInt(minY, maxY);
          overlap = prev.some(ft => {
            if (ft.selected) return false;
            const ftEstimatedHeight = ft.text.length * ft.fontSize * 0.8;
            const ftAvailableHeight = containerSize.height - 80 - 60;
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
            const margin = 20;
            return (
              x < ft.x + ftTextWidth + margin &&
              x + textWidth + margin > ft.x &&
              y < ft.y + ftTextHeight + margin &&
              y + textHeight + margin > ft.y
            );
          });
          tryCount++;
        } while (overlap && tryCount < 150);
        
        const lifetime = getRandomInt(2500, 3500);
        const newId = idRef.current++;
        
        timers.push(setTimeout(() => {
          setFloatingTexts((prev2) => prev2.map((ft) => 
            ft.id === newId ? { ...ft, visible: false } : ft
          ));
          setHoveredText((current) => current?.id === newId ? null : current);
        }, lifetime));
        
        timers.push(setTimeout(() => {
          setFloatingTexts((prev2) => prev2.filter((ft) => ft.id !== newId));
          setHoveredText((current) => current?.id === newId ? null : current);
        }, lifetime + 700));
        
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
      
      timers.push(setTimeout(spawnText, getRandomInt(1200, 2200)));
    };
    
    spawnText();
    return () => timers.forEach(clearTimeout);
  }, [containerSize.width, containerSize.height, selectedTextIds]);

  const handleTextClick = (t: FloatingText) => {
    if (t.selected) return;
    
    setHoveredText((current) => current?.id === t.id ? null : current);
    
    setGenkou((prev) => {
      const newGenkou = prev.map((col) => [...col]);
      let { col, row } = nextCell;
      let newKutenMap: { col: number; row: number; char: string }[] = [];
      
      for (let i = 0; i < t.text.length; i++) {
        if (row >= GENKOU_ROWS) {
          col--;
          row = 0;
        }
        if (col < 0) break;
        
        if (isKutenOrTouten(t.text[i])) {
          newKutenMap.push({ col, row, char: t.text[i] });
          row++;
        } else {
          newGenkou[col][row] = t.text[i];
          row++;
        }
      }
      
      setKutenMap((prevKuten) => [...prevKuten, ...newKutenMap]);
      return newGenkou;
    });
    
    setNextCell((prev) => {
      let { col, row } = prev;
      let consume = t.text.length;
      row += consume;
      while (row >= GENKOU_ROWS) {
        row -= GENKOU_ROWS;
        col--;
      }
      if (col < 0) return { col: 0, row: GENKOU_ROWS - 1 };
      return { col, row };
    });
    
    setFloatingTexts((prev) => 
      prev.map((ft) => ft.id === t.id ? { ...ft, selected: true, visible: false } : ft)
    );
    
    setSelectedTextIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(t.text);
      return newSet;
    });
  };

  const handleReset = () => {
    setGenkou(Array(GENKOU_COLS).fill('').map(() => Array(GENKOU_ROWS).fill('')));
    setNextCell({ col: GENKOU_COLS - 1, row: 0 });
    setSelectedTextIds(new Set());
    setKutenMap([]);
    setHoveredText(null);
    setFloatingTexts([]);
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
      <button 
        className="taisho-btn taisho-reset" 
        style={{ position: 'fixed', top: 24, right: 32, zIndex: 100 }} 
        onClick={handleReset}
      >
        リセット
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
          }}>
            15×15
          </div>

          <svg 
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
                        fill="#a85c2c"
                        opacity="0.3"
                        style={{ 
                          fontFamily: 'Yu Mincho, serif', 
                          writingMode: 'vertical-rl', 
                          textOrientation: 'upright' 
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
                    fontSize={16}
                    textAnchor="middle"
                    fill="#a85c2c"
                    opacity="0.3"
                    style={{ 
                      fontFamily: 'Yu Mincho, serif', 
                      writingMode: 'vertical-rl', 
                      textOrientation: 'upright' 
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
                    fill="#3b2c1a"
                    style={{ 
                      fontFamily: 'Yu Mincho, serif', 
                      writingMode: 'vertical-rl', 
                      textOrientation: 'upright' 
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
                fontSize={16}
                textAnchor="middle"
                fill="#3b2c1a"
                style={{ 
                  fontFamily: 'Yu Mincho, serif', 
                  writingMode: 'vertical-rl', 
                  textOrientation: 'upright' 
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
            paddingTop: '80px', 
            paddingRight: '20px', 
            paddingBottom: '40px', 
            paddingLeft: '20px',
            flexGrow: 1
          }}
        >
          {floatingTexts.filter(t => !t.selected).map((t) => {
            const fontSize = t.fontSize;
            const estimatedTextHeight = t.text.length * fontSize * 0.8;
            const availableHeight = containerSize.height - 80 - 60;
            
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
