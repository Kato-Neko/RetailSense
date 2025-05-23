import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  turbo = false,
  ...props
}) {
  // Turbo colormap: red, orange, yellow, green, cyan, blue, violet
  const turboGradient =
    "linear-gradient(90deg, \
    #ff0022 0%, \
    #ff7a00 10%, \
    #ffef00 20%, \
    #21ff00 30%, \
    #00cfff 40%, \
    #002bff 50%, \
    #7a00ff 60%, \
    #e100ff 70%, \
    #ff00d4 80%, \
    #ff0062 90%, \
    #ff0062 100%\)";

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all",
          turbo && "animate-turbo-progress"
        )}
        style={turbo ? {
          background: turboGradient,
          backgroundSize: '200% 100%',
          backgroundPosition: '0% 0%',
          transform: `translateX(-${100 - (value || 0)}%)`,
        } : {
          transform: `translateX(-${100 - (value || 0)}%)`
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress }

// Add turbo-progress animation
// You can move this to your global CSS if you prefer
const style = document.createElement('style');
style.innerHTML = `
@keyframes turbo-progress {
  0% { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}
.animate-turbo-progress {
  animation: turbo-progress 2s linear infinite;
}
`;
if (typeof document !== 'undefined' && !document.getElementById('turbo-progress-style')) {
  style.id = 'turbo-progress-style';
  document.head.appendChild(style);
}
