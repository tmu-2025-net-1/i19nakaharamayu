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
const GENKOU_ROWS = 20;
const GENKOU_COLS = 20;

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
  // マスの右上の位置を計算（少し右側に寄せる）
  return { x: col * 30 + 25, y: row * 30 + 8 };
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
        const maxTextLen = Math.floor((containerSize.height - 100) / fontSize); // 余裕を持った計算
        const text = candidates[getRandomInt(0, candidates.length - 1)];
        const lines = [];
        for (let i = 0; i < text.length; i += maxTextLen) {
          lines.push(text.slice(i, i + maxTextLen));
        }
        // テキストの描画サイズを計算（全文を表示できるように）
        const textWidth = lines.length * fontSize * 1.2; // 縦書きなので幅は行数×フォントサイズ（余裕を持たせる）
        const textHeight = Math.max(maxTextLen * fontSize, text.length * fontSize); // 全文の高さを確保
        // 配置範囲を親要素内に制限（リセットボタンとの重なりを避ける）
        const minX = 0;
        const maxX = Math.max(0, containerSize.width - textWidth - 40); // 右端に余裕を持たせる
        const minY = 80; // リセットボタンの下に配置するため上部に余裕を持たせる
        const maxY = Math.max(minY, containerSize.height - textHeight - 40); // 下部にも余裕を持たせる
        let x = 0, y = 0, tryCount = 0, overlap = false;
        do {
          x = getRandomInt(minX, maxX);
          y = getRandomInt(minY, maxY);
          overlap = prev.some(ft => {
            // テキストの矩形同士が重なっているか
            const ftWidth = (ft.text.length / maxTextLen) * ft.fontSize * 1.2 || ft.fontSize * 1.2;
            const ftHeight = Math.min(maxTextLen, ft.text.length) * ft.fontSize;
            return (
              x < ft.x + ftWidth &&
              x + textWidth > ft.x &&
              y < ft.y + ftHeight &&
              y + textHeight > ft.y
            );
          });
          tryCount++;
        } while (overlap && tryCount < 100);
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
  };

  return (
    <div style={{ minHeight: '100vh', width: '100vw', position: 'relative', overflow: 'auto' }}>
      <button className="taisho-btn taisho-reset" style={{ position: 'fixed', top: 24, right: 32, zIndex: 100 }} onClick={handleReset}>リセット</button>
      <div style={{ display: 'flex', flexDirection: 'row', width: '100vw', maxWidth: 1200, margin: '0 auto', minHeight: '80vh', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        {/* 左側：原稿用紙 */}
        <div className="taisho-paper" style={{ position: 'relative', writingMode: 'vertical-rl', textOrientation: 'upright', margin: '0 150px 0 0', maxWidth: 700, width: '50%', minWidth: 320, height: '80vh', overflow: 'auto', background: '#fffdfa', alignSelf: 'flex-end', bottom: '-100px', left: 0 }}>
          <svg width="100%" height={GENKOU_ROWS * 30} viewBox={`0 0 ${GENKOU_COLS * 30} ${GENKOU_ROWS * 30}`} style={{ width: '100%', height: '100%', background: 'none' }}>
            {/* マス目 */}
            {[...Array(GENKOU_ROWS + 1)].map((_, r) => (
              <line
                key={`h${r}`}
                x1={0}
                y1={r * 30}
                x2={GENKOU_COLS * 30}
                y2={r * 30}
                stroke="#a85c2c"
                strokeWidth={r === 0 || r === GENKOU_ROWS ? 2 : 1}
              />
            ))}
            {[...Array(GENKOU_COLS + 1)].map((_, c) => (
              <line
                key={`v${c}`}
                x1={c * 30}
                y1={0}
                x2={c * 30}
                y2={GENKOU_ROWS * 30}
                stroke="#a85c2c"
                strokeWidth={c === 0 || c === GENKOU_COLS ? 2 : 1}
              />
            ))}
            {/* 文字（縦書き・右上から） */}
            {genkou.map((col, c) =>
              col.map((ch, r) =>
                ch ? (
                  <text
                    key={`t${c}-${r}`}
                    x={c * 30 + 15}
                    y={r * 30 + 22}
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
            // 折り返し処理（全文表示を保証）
            const fontSize = t.fontSize;
            const maxTextLen = Math.floor((containerSize.height - 100) / fontSize); // より余裕を持った計算
            const lines = [];
            for (let i = 0; i < t.text.length; i += maxTextLen) {
              lines.push(t.text.slice(i, i + maxTextLen));
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
                  whiteSpace: 'pre-wrap',
                  minHeight: 'auto', // 最小高さを自動に
                  overflow: 'visible', // オーバーフローを表示
                  maxWidth: 60 * lines.length, // 幅をさらに広く
                  width: 'auto', // 幅を自動調整
                  height: 'auto', // 高さを自動調整
                  wordBreak: 'break-all',
                  pointerEvents: t.selected ? 'none' : 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start', // 描画開始位置から揃え
                  justifyContent: 'flex-start', // 描画開始位置から揃え
                  textAlign: 'left', // 継承されるtext-alignを明示的に上書き
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
