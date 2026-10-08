import { cn } from "@/lib/utils";

type ContainerSize = "default" | "narrow" | "wide";

const sizes: Record<ContainerSize, string> = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[1400px]",
};

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
}

/** Horizontal page gutter: 16px on phones, 24px tablet, 32px desktop. */
export function Container({ size = "default", className, ...props }: ContainerProps) {
  return (
    <div
      className={cn("relative mx-auto w-full px-4 sm:px-6 lg:px-8", sizes[size], className)}
      {...props}
    />
  );
}
