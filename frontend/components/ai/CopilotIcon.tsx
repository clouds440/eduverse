import Image from "next/image";
import { cn } from "@/lib/utils";

interface CopilotIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function CopilotIcon({ className, ...props }: CopilotIconProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Image
        src="/assets/copilot-icon.png"
        alt=""
        width={20}
        height={20}
        className="h-full w-full object-contain"
        aria-hidden="true"
      />
    </span>
  );
}
