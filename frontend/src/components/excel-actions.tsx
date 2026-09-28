"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api, apiUrl, ApiError } from "@/lib/api";

export function ExcelActions({
  exportPath,
  exportFileName,
  importPath,
  templatePath,
  invalidateKey,
  importWarning,
}: {
  exportPath: string;
  exportFileName: string;
  importPath?: string;
  // Import qanday ustunlar kutayotganini ko'rsatadigan bo'sh shablon fayl
  // (bitta namuna qator bilan) - faqat importPath berilganda ma'noli.
  templatePath?: string;
  invalidateKey?: string | string[];
  // Import tugmasi yonida ko'rsatiladigan qisqa ogohlantirish (masalan dublikat xavfi haqida).
  importWarning?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  async function downloadFile(path: string, filename: string) {
    try {
      const res = await fetch(apiUrl(path), { credentials: "include" });
      if (!res.ok) throw new Error("Yuklab olishda xatolik");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Excel faylni yuklab olishda xatolik yuz berdi");
    }
  }

  async function handleImportFile(file: File) {
    if (!importPath) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.post<{ created: number; updated: number; errors?: string[] }>(
        importPath,
        formData
      );
      toast.success(`Import tugadi: ${result.created} ta yangi, ${result.updated} ta yangilandi`);
      // Ba'zi qatorlar o'tkazib yuborilgan bo'lsa (masalan hamkor topilmadi) - sabablari alohida ko'rsatiladi.
      if (result.errors && result.errors.length > 0) {
        const shown = result.errors.slice(0, 5).join("\n");
        const more = result.errors.length > 5 ? `\n... va yana ${result.errors.length - 5} ta` : "";
        toast.warning(`${result.errors.length} ta qatorda xatolik`, {
          description: shown + more,
          duration: 15000,
        });
      }
      for (const key of invalidateKey ? [invalidateKey].flat() : []) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Import qilishda xatolik yuz berdi");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadFile(exportPath, exportFileName)}
      >
        <Download className="h-4 w-4" />
        Excelga eksport
      </Button>
      {importPath && templatePath && (
        <Button
          variant="outline"
          size="sm"
          title="Import uchun shablon fayl - qanday ustunlar kerakligini ko'rsatadi"
          onClick={() => downloadFile(templatePath, exportFileName.replace(".xlsx", "-shablon.xlsx"))}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Shablon
        </Button>
      )}
      {importPath && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {importing ? "Yuklanmoqda..." : "Excel'dan import"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
            }}
          />
        </>
      )}
    </div>
    {importPath && importWarning && (
      <p className="flex max-w-md items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {importWarning}
      </p>
    )}
    </div>
  );
}
