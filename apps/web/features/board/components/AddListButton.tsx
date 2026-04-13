import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Plus, X } from "lucide-react";

interface AddListButtonProps {
  onAdd: (name: string) => void;
  canWrite?: boolean;
}

export const AddListButton: React.FC<AddListButtonProps> = ({ onAdd, canWrite = true }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [listName, setListName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (listName.trim()) {
      onAdd(listName);
      setListName("");
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setListName("");
  };

  if (isAdding) {
    return (
      <div className="min-w-70 max-w-70 rounded-lg bg-gray-100 p-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="Nhập tên list..."
            autoFocus
            disabled={!canWrite}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                handleCancel();
              }
            }}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!canWrite}>
              Thêm list
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className="min-w-70 max-w-70 justify-start bg-white/20 text-white hover:bg-white/30"
      onClick={() => setIsAdding(true)}
      disabled={!canWrite}
      title={!canWrite ? "Board đang ở chế độ chỉ xem" : undefined}
    >
      <Plus className="mr-2 h-4 w-4" />
      Thêm list
    </Button>
  );
};
