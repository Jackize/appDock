import { cn } from "@/lib/utils";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

type CheckedState = boolean | "indeterminate";

interface CheckboxProps
  extends Omit<
    ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    "checked" | "onCheckedChange"
  > {
  checked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
}

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "w-5 h-5 rounded border border-border bg-background-tertiary flex items-center justify-center",
        "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
        "data-[state=indeterminate]:bg-accent data-[state=indeterminate]:border-accent transition-colors",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {checked === "indeterminate" ? (
          <Minus className="w-3.5 h-3.5 text-white" />
        ) : (
          <Check className="w-3.5 h-3.5 text-white" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
