import Image from "next/image";

export const FINNING_LOGO_SRC = "/brand/finning-cat-logo.png";

const SIZE_CLASS = {
  sm: "w-32",
  md: "w-40",
  lg: "w-52",
} as const;

export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <Image
      src={FINNING_LOGO_SRC}
      alt="Finning CAT"
      width={520}
      height={111}
      className={`${SIZE_CLASS[size]} h-auto ${className}`}
      priority={size === "lg"}
    />
  );
}
