"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { User } from "@/lib/types";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<User>("auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, setUser };
}
