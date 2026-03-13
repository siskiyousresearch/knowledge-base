"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

interface SuggestedQuestionsProps {
  projectId: string;
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ projectId, onSelect }: SuggestedQuestionsProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    fetch(`/api/projects/${projectId}/suggestions`, { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch suggestions");
        return res.json();
      })
      .then((data) => {
        setQuestions(Array.isArray(data) ? data.slice(0, 4) : data.questions?.slice(0, 4) || []);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (error) return null;

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {questions.map((question, i) => (
        <Card
          key={i}
          className="cursor-pointer p-3 transition-colors hover:bg-accent"
          onClick={() => onSelect(question)}
        >
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-snug">{question}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
