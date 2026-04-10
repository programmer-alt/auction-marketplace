import { useEffect, useState } from 'react';

interface ScanLineProps {
  /** Цвет линии в CSS-формате (например, '#0f0') */
  color?: string;
  /** Толщина линии в пикселях (по умолчанию 3px) */
  thickness?: number;
  /** Скорость анимации в секундах (время одного прохода сверху вниз) */
  duration?: number;
  /** Задержка перед началом анимации в секундах */
  delay?: number;
  /** Дополнительные классы для контейнера */
  className?: string;
}

/**
 * Горизонтальная сканирующая линия на всю ширину экрана.
 * Движется сверху вниз бесконечно с неоновым свечением.
 * Использует position: fixed, поэтому не зависит от родительского контейнера.
 */
export default function ScanLine({
  color = '#0f0',
  thickness = 3,
  duration = 3,
  delay = 0,
  className = '',
}: ScanLineProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 9999 }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: '100%',
          height: `${thickness}px`,
          backgroundColor: color,
          boxShadow: `
            0 0 8px ${color},
            0 0 16px ${color},
            0 0 32px ${color}
          `,
          opacity: isVisible ? 0.85 : 0,
          transition: 'opacity 0.5s ease',
          animation: isVisible ? `scan-vertical ${duration}s linear infinite` : 'none',
        }}
      />
      <style>{`
        @keyframes scan-vertical {
          0% {
            top: -${thickness}px;
          }
          100% {
            top: 100%;
          }
        }
      `}</style>
    </div>
  );
}
