import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { GeminiSync } from "@/components/GeminiSync";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes · Slate" },
      { name: "description", content: "Conecte o Gemini para planejar seu dia." },
    ],
  }),
  component: Settings,
});

function Settings() {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 pb-28 pt-12">
      <header className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Gemini</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Converse, envie fotos ou PDFs e deixe o Gemini planejar suas tarefas. Nada muda até você tocar em Aplicar.
        </p>
      </header>
      <GeminiSync />
      <BottomNav />
    </div>
  );
}
