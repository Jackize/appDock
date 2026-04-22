import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitesAPI } from "@/services/api";

export function useInvites() {
  return useQuery({
    queryKey: ["invites"],
    queryFn: () => invitesAPI.list(),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => invitesAPI.create(email),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["invites"] });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => invitesAPI.revoke(email),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["invites"] });
    },
  });
}

