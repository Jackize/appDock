import type { Image } from "@/types";

export function filterImages(images: Image[] | undefined, query: string) {
  if (!images) return [];
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return images;

  return images.filter(
    (image) =>
      image.repoTags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
      image.id.toLowerCase().includes(normalizedQuery),
  );
}

export function splitImagesByUsage(images: Image[]) {
  return {
    inUseImages: images.filter((image) => image.inUse),
    unusedImages: images.filter((image) => !image.inUse),
  };
}

export function getMainImageTag(repoTags: string[]) {
  if (!repoTags || repoTags.length === 0 || repoTags[0] === "<none>:<none>") {
    return "<không có tag>";
  }
  return repoTags[0];
}

export function parseImageTag(repoTags: string[]) {
  const mainTag = getMainImageTag(repoTags);
  if (!mainTag.includes(":")) {
    return { name: mainTag, tag: "latest" };
  }

  const tagSeparatorIndex = mainTag.lastIndexOf(":");
  return {
    name: mainTag.slice(0, tagSeparatorIndex),
    tag: mainTag.slice(tagSeparatorIndex + 1),
  };
}

export function getSelectedImagesSize(images: Image[], selectedIds: Set<string>) {
  return images
    .filter((image) => selectedIds.has(image.id))
    .reduce((acc, image) => acc + image.size, 0);
}

export function getSelectionState(images: Image[], selectedIds: Set<string>) {
  const allSelected =
    images.length > 0 && images.every((image) => selectedIds.has(image.id));
  const someSelected = images.some((image) => selectedIds.has(image.id));

  return {
    allSelected,
    someSelected,
    checkboxState: allSelected ? true : someSelected ? "indeterminate" : false,
  } as const;
}
