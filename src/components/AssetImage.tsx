import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

export const AssetImage = ({ src, fallback, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fallback?: ReactNode }) => {
  const [failed, setFailed] = useState(false);
  if (failed && fallback) return <>{fallback}</>;
  return <img {...props} src={src} decoding="async" onError={() => setFailed(true)} />;
};