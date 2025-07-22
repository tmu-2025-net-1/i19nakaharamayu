import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// ランダムに表示されるテキスト候補
const TEXT_CANDIDATES = [
  '彼は一度も私と目を合わせようとしない。',
  '右往左往にさまよう瞳すら見られない。',
  'ただの背中は一体何を私に教えてくれるのだろうか。',
  'ただだるそうに棒アイスを口に咥えながらスマホを眺めてた。',
  'ねぇ。何したらこっち見てくれる？',
];

// 原稿用紙のマス数
const GENKOU_ROWS = 15;
const GENKOU_COLS = 15;

// 浮遊テキストの型
interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  visible: boolean;
  lifetime: number;
  selected: boolean; // 必ずboolean型で管理
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 句読点を右上に描画するための判定関数
function isKutenOrTouten(ch: string) {
  return ch === '。' || ch === '、' || ch === '，' || ch === '．' || ch === ',' || ch === '.';
}

// 句読点の位置をマスの右上に計算する関数
function getKutenPosition(col: number, row: number) {
  // マスの右上の位置を計算（列間スペース6pxを考慮）
  const cellSize = 30;
  const colSpacing = 6; // 列間スペース
  return { x: col * (cellSize + colSpacing) + cellSize - 5, y: row * cellSize + 8 };
}

const App: React.FC = () => {
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
  const [genkou, setGenkou] = useState<string[][]>(Array(GENKOU_COLS).fill('').map(() => Array(GENKOU_ROWS).fill('')));
  const [kutenMap, setKutenMap] = useState<{ col: number; row: number; char: string }[]>([]); // 句読点の位置管理
  const [nextCell, setNextCell] = useState<{ col: number; row: number }>({ col: GENKOU_COLS - 1, row: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // ウィンドウサイズ取得
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

  // 浮遊テキスト生成・アニメーション
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
        
        // テキストの描画サイズを事前計算
        const estimatedTextHeight = text.length * fontSize * 0.8; // 1文字あたりの概算高さ
        const availableHeight = containerSize.height - 80 - 60; // 上下のマージンを除いた利用可能な高さ
        
        const lines = [];
        // 改行処理：ウィンドウから見切れる場合のみ改行
        if (estimatedTextHeight <= availableHeight) {
          // 見切れない場合は改行しない
          lines.push(text);
        } else {
          // 見切れる場合のみ改行
          const maxTextLen = Math.floor(availableHeight / fontSize);
          for (let i = 0; i < text.length; i += maxTextLen) {
            lines.push(text.slice(i, i + maxTextLen));
          }
        }
        // テキストの描画サイズを計算（全文を表示できるように）
        const textWidth = lines.length * fontSize * 1.2; // 縦書きなので幅は行数×フォントサイズ（余裕を持たせる）
        const textHeight = text.length * fontSize; // 全文の高さを確保
        // 配置範囲を親要素内に制限（リセットボタンとの重なりを避ける）
        const minX = 60; // 左端により多くの余裕を持たせる
        const maxX = Math.max(120, containerSize.width - textWidth - 120); // 右端により多くの余裕を持たせる
        
        // y座標の範囲をシンプルに設定：見切れない範囲で適度にばらける
        const minY = 80; // リセットボタンの下
        const maxY = Math.max(minY + 100, containerSize.height - textHeight - 60); // 十分な余裕を確保
        let x = 0, y = 0, tryCount = 0, overlap = false;
        do {
          x = getRandomInt(minX, maxX);
          y = getRandomInt(minY, maxY);
          overlap = prev.some(ft => {
            if (ft.selected) return false; // 選択済みのテキストは重なり判定から除外
            // テキストの矩形同士が重なっているか（マージンを多めに取る）
            const ftEstimatedHeight = ft.text.length * ft.fontSize * 0.8;
            const ftAvailableHeight = containerSize.height - 80 - 60;
            const ftLines = [];
            if (ftEstimatedHeight <= ftAvailableHeight) {
              ftLines.push(ft.text);
            } else {
              const ftMaxTextLen = Math.floor(ftAvailableHeight / ft.fontSize);
              for (let i = 0; i < ft.text.length; i += ftMaxTextLen) {
                ftLines.push(ft.text.slice(i, i + ftMaxTextLen));
              }
            }
            const ftWidth = ftLines.length * ft.fontSize * 1.3; // より多めのマージン
            const ftHeight = Math.min(ftAvailableHeight, ft.text.length * ft.fontSize * 0.8) * 1.1; // 高さにもマージン
            const margin = 20; // 追加のマージン
            return (
              x < ft.x + ftWidth + margin &&
              x + textWidth + margin > ft.x &&
              y < ft.y + ftHeight + margin &&
              y + textHeight + margin > ft.y
            );
          });
          tryCount++;
        } while (overlap && tryCount < 150); // 試行回数を増やす
        const lifetime = getRandomInt(2500, 3500);
        const newId = idRef.current++;
        timers.push(setTimeout(() => {
          setFloatingTexts((prev2) => prev2.map((ft) => ft.id === newId ? { ...ft, visible: false } : ft));
        }, lifetime));
        timers.push(setTimeout(() => {
          setFloatingTexts((prev2) => prev2.filter((ft) => ft.id !== newId));
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

  // テキストクリック時、原稿用紙に転記（句読点は一個前の文字の右下に配置）
  const handleTextClick = (t: FloatingText) => {
    if (t.selected) return;
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
          // 句読点は原稿用紙には書かず、kutenMapにのみ追加
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
    setFloatingTexts((prev) => prev.map((ft) => ft.id === t.id ? { ...ft, selected: true, visible: false } : ft));
    setSelectedTextIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(t.text);
      return newSet;
    });
  };

  // リセット
  const handleReset = () => {
    setGenkou(Array(GENKOU_COLS).fill('').map(() => Array(GENKOU_ROWS).fill('')));
    setNextCell({ col: GENKOU_COLS - 1, row: 0 });
    setSelectedTextIds(new Set());
    setKutenMap([]);
    // 浮遊テキストもリセット時にクリア
    setFloatingTexts([]);
  };

  return (
    <div style={{ minHeight: '100vh', width: '100vw', position: 'relative', overflow: 'auto' }}>
      <button className="taisho-btn taisho-reset" style={{ position: 'fixed', top: 24, right: 32, zIndex: 100 }} onClick={handleReset}>リセット</button>
      <div style={{ display: 'flex', flexDirection: 'row', width: '100vw', maxWidth: 1200, margin: '0 auto', minHeight: '80vh', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        {/* 左側：原稿用紙 */}
        <div className="taisho-paper" style={{ position: 'relative', writingMode: 'vertical-rl', textOrientation: 'upright', margin: '0 150px 0 0', maxWidth: 700, width: '50%', minWidth: 320, height: '80vh', overflow: 'auto', background: '#f5f0e8', alignSelf: 'flex-end', bottom: '-100px', left: 0, border: '2px solid #8b7355', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', padding: '20px' }}>
          {/* バインダー用の穴 */}
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
          
          {/* 15×15の表記 */}
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

          <svg width="100%" height={GENKOU_ROWS * 30} viewBox={`0 0 ${(GENKOU_COLS * 30) + ((GENKOU_COLS - 1) * 6)} ${GENKOU_ROWS * 30}`} style={{ width: '100%', height: '100%', background: 'transparent' }}>
            {/* マス目の描画（列間スペース6px付き） */}
            {[...Array(GENKOU_ROWS)].map((_, r) => (
              [...Array(GENKOU_COLS)].map((_, c) => {
                const x = c * (30 + 6); // 30pxのマス + 6pxの列間隔
                const y = r * 30; // 30pxのマス（行間隔なし）
                return (
                  <rect
                    key={`cell-${r}-${c}`}
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
            {/* 文字（縦書き・右上から） */}
            {genkou.map((col, c) =>
              col.map((ch, r) =>
                ch ? (
                  <text
                    key={`t${c}-${r}`}
                    x={c * (30 + 6) + 15}
                    y={r * 30 + 20}
                    fontSize={20}
                    textAnchor="middle"
                    fill="#3b2c1a"
                    style={{ fontFamily: 'Yu Mincho, serif', writingMode: 'vertical-rl', textOrientation: 'upright' }}
                  >
                    {ch}
                  </text>
                ) : null
              )
            )}
            {/* 句読点（右上） */}
            {kutenMap.map(({ col, row, char }, idx) => (
              <text
                key={`kuten-${col}-${row}-${idx}`}
                x={getKutenPosition(col, row).x}
                y={getKutenPosition(col, row).y}
                fontSize={16}
                textAnchor="middle"
                fill="#3b2c1a"
                style={{ fontFamily: 'Yu Mincho, serif', writingMode: 'vertical-rl', textOrientation: 'upright' }}
              >
                {char}
              </text>
            ))}
          </svg>
        </div>
        {/* 右側：浮遊テキスト（重なり防止・折り返し対応） */}
        <div ref={containerRef} style={{ position: 'relative', width: '50%', minWidth: 320, height: '80vh', minHeight: 400, overflow: 'visible', background: 'none', paddingTop: '80px', paddingRight: '40px', paddingBottom: '40px', paddingLeft: '10px' }}>
          {floatingTexts.filter(t => !t.selected).map((t) => {
            // 折り返し処理（ウィンドウから見切れる場合のみ改行）
            const fontSize = t.fontSize;
            const estimatedTextHeight = t.text.length * fontSize * 0.8;
            const availableHeight = containerSize.height - 80 - 60;
            
            const lines = [];
            if (estimatedTextHeight <= availableHeight) {
              // 見切れない場合は改行しない
              lines.push(t.text);
            } else {
              // 見切れる場合のみ改行
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
                  whiteSpace: 'nowrap', // 改行を制御
                  overflow: 'visible',
                  maxWidth: 'none', // 幅制限を削除
                  width: 'auto',
                  height: 'auto',
                  wordBreak: 'keep-all', // 単語の途中で改行しない
                  pointerEvents: t.selected ? 'none' : 'auto',
                  display: 'flex',
                  flexDirection: 'row', // 縦書きのため横方向に並べる
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  gap: '0px', // 行間を詰める
                }}
                onClick={() => handleTextClick(t)}
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
