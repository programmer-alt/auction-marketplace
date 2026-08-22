import { useEffect, useState } from "react";

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
  /** Интенсивность подсветки (0-1) */
  highlightIntensity?: number;
  /** Ширина светового следа в пикселях */
  highlightWidth?: number;
}

/**
 * Горизонтальная сканирующая линия на всю ширину экрана.
 * Движется сверху вниз бесконечно с неоновым свечением.
 * Использует position: fixed, поэтому не зависит от родительского контейнера.
 * Создает эффект подсветки страницы под линией с помощью mix-blend-mode.
 */
export default function ScanLine({
  color = "#0f0",
  thickness = 3,
  duration = 3,
  delay = 0,
  className = "",
  highlightIntensity = 0.4,
  highlightWidth = 200,
}: ScanLineProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  // Цвет для подсветки с прозрачностью
  const highlightColor =
    color +
    Math.round(highlightIntensity * 255)
      .toString(16)
      .padStart(2, "0");
  const lightColor = `${color}40`; // Более прозрачный вариант

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`} style={{ zIndex: 9999 }}>
      {/* Основная линия с неоновым свечением */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          height: `${thickness}px`,
          backgroundColor: color,
          boxShadow: `
            0 0 10px ${color},
            0 0 20px ${color},
            0 0 40px ${color},
            0 0 80px ${color}
          `,
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.5s ease",
          animation: isVisible ? `scan-vertical ${duration}s linear infinite` : "none",
          zIndex: 3,
        }}
      />

      {/* Яркий световой след (mix-blend-mode: screen) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          height: `${highlightWidth}px`,
          background: `linear-gradient(to bottom, 
            transparent 0%, 
            ${highlightColor} 15%, 
            ${color}FF 50%, 
            ${highlightColor} 85%, 
            transparent 100%)`,
          opacity: isVisible ? highlightIntensity : 0,
          transition: "opacity 0.5s ease",
          animation: isVisible ? `scan-vertical ${duration}s linear infinite` : "none",
          zIndex: 2,
          mixBlendMode: "screen",
          filter: "blur(15px)",
          transform: "translateY(-50%)",
        }}
      />

      {/* Широкий рассеянный свет */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          height: `${highlightWidth * 1.5}px`,
          background: `radial-gradient(ellipse at center, 
            ${lightColor} 0%, 
            ${color}22 30%, 
            transparent 70%)`,
          opacity: isVisible ? highlightIntensity * 0.7 : 0,
          transition: "opacity 0.5s ease",
          animation: isVisible ? `scan-vertical ${duration}s linear infinite` : "none",
          zIndex: 1,
          filter: "blur(25px)",
          transform: "translateY(-50%)",
        }}
      />

      {/* Эффект увеличения яркости элементов под линией (через псевдоэлемент) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          height: `${highlightWidth}px`,
          background: `linear-gradient(to bottom, 
            ${color}33 0%, 
            ${color}66 50%, 
            ${color}33 100%)`,
          opacity: isVisible ? 0.3 : 0,
          transition: "opacity 0.5s ease",
          animation: isVisible ? `scan-vertical ${duration}s linear infinite` : "none",
          zIndex: 0,
          mixBlendMode: "lighten",
          filter: "blur(10px)",
          transform: "translateY(-50%)",
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
        
        /* Глобальный эффект для всей страницы при прохождении линии */
        .scan-line-active {
          transition: filter 0.3s ease;
        }
        
        .scan-line-active::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(
            ellipse at center,
            ${color}22 0%,
            transparent 70%
          );
          opacity: 0;
          z-index: 9998;
          pointer-events: none;
          animation: pulse-light ${duration / 2}s ease-in-out infinite;
        }
        
        @keyframes pulse-light {
          0%, 100% {
            opacity: 0;
          }
          50% {
            opacity: 0.1;
          }
        }
      `}</style>
    </div>
  );
}
