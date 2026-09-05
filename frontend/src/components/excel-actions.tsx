"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api, apiUrl, ApiError } from "@/lib/api";

export function ExcelActions({
  exportPath,
  exportFileName,
  importPath,
  invalidateKey,
}: {
  exportPath: string;
  exportFileName: string;
  importPath?: string;
  invalidateKey?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  async function handleExport() {
    try {
      const res = await fetch(apiUrl(exportPath), { credentials: "include" });
      if (!res.ok) throw new Error("Export qilishda xatolik");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName;
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
      const result = await api.post<{ created: number; updated: number }>(importPath, formData);
      toast.success(`Import tugadi: ${result.created} ta yangi, ${result.updated} ta yangilandi`);
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: [invalidateKey] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Import qilishda xatolik yuz berdi");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="h-4 w-4" />
        Excelga eksport
      </Button>
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
  );
}
