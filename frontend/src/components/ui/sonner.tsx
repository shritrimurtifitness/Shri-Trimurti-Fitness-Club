import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:p-4",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-gradient-turf group-[.toast]:text-primary-foreground group-[.toast]:shadow-turf group-[.toast]:font-semibold group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:hover:opacity-90 transition-opacity",
          cancelButton: "group-[.toast]:bg-secondary group-[.toast]:text-foreground group-[.toast]:font-medium group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:hover:bg-secondary/80 transition-colors",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
