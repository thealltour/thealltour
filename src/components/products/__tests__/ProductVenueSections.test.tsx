import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  buildVenuePhotoGroups,
  ProductVenuePhotosSection,
  venuePhotosHeading,
} from "@/components/products/venues/ProductVenuePhotosSection";

const hotels = [
  { name: "마젤란 리조트", content: "오션뷰 객실", images: ["https://cdn.example.com/hotel-1.webp"] },
  { name: "퍼시픽 호텔", content: "시내 중심" },
];
const attractions = [
  { name: "마누칸 섬", content: "스노클링 포인트", images: ["https://cdn.example.com/attraction-1.webp"] },
  { name: "시티 모스크", content: "야경 명소" },
];

describe("ProductVenuePhotosSection", () => {
  it("groups only venues that have photos", () => {
    const groups = buildVenuePhotoGroups(
      [{ name: "수트라하버 GC", content: "", images: ["https://cdn.example.com/golf-1.webp"] }],
      hotels,
      attractions,
    );
    expect(groups.map((g) => [g.kindLabel, g.name, g.images.length])).toEqual([
      ["골프장", "수트라하버 GC", 1],
      ["호텔", "마젤란 리조트", 1],
      ["관광지", "마누칸 섬", 1],
    ]);
    expect(venuePhotosHeading(groups)).toBe("골프장·호텔·관광지 사진");
  });

  it("renders nothing when no venue has photos", () => {
    const { container } = render(
      <ProductVenuePhotosSection golfCourses={[{ name: "A GC", content: "설명" }]} hotels={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens the gallery modal for the clicked venue", () => {
    render(<ProductVenuePhotosSection golfCourses={null} hotels={hotels} />);
    expect(screen.getByRole("region", { name: "호텔 사진" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "마젤란 리조트 이미지 1 크게 보기" }));
    const dialog = screen.getByRole("dialog", { name: "마젤란 리조트 호텔 사진" });
    expect(dialog.textContent).toContain("호텔 · 마젤란 리조트");
    expect(dialog.textContent).toContain("오션뷰 객실");
  });

  it("keeps a single attraction photo at thumbnail width while hotels keep the wide single image", () => {
    render(<ProductVenuePhotosSection golfCourses={null} hotels={hotels} attractions={attractions} />);
    const attractionThumb = screen.getByRole("button", { name: "마누칸 섬 이미지 1 크게 보기" });
    const hotelThumb = screen.getByRole("button", { name: "마젤란 리조트 이미지 1 크게 보기" });
    expect(attractionThumb.className).toContain("w-[min(48vw,11rem)]");
    expect(attractionThumb.className).not.toContain("w-full");
    expect(hotelThumb.className).toContain("w-full");
  });

  it("caps multi-photo attractions and hotels at thumbnail width", () => {
    const threePhotos = ["a", "b", "c"].map((k) => `https://cdn.example.com/${k}.webp`);
    render(
      <ProductVenuePhotosSection
        golfCourses={null}
        hotels={[{ name: "마젤란 리조트", content: "", images: threePhotos }]}
        attractions={[{ name: "별빛투어", content: "", images: threePhotos }]}
      />,
    );
    const attractionThumb = screen.getByRole("button", { name: "별빛투어 이미지 1 크게 보기" });
    const hotelThumb = screen.getByRole("button", { name: "마젤란 리조트 이미지 1 크게 보기" });
    expect(attractionThumb.className).toContain("lg:max-w-[14rem]");
    expect(hotelThumb.className).toContain("w-[calc(33.333%-0.34rem)]");
    expect(hotelThumb.className).toContain("lg:max-w-[14rem]");
  });

  it("includes attraction photos with a heading that lists the kinds shown", () => {
    render(<ProductVenuePhotosSection golfCourses={null} hotels={hotels} attractions={attractions} />);
    expect(screen.getByRole("region", { name: "호텔·관광지 사진" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "마누칸 섬 이미지 1 크게 보기" }));
    expect(screen.getByRole("dialog", { name: "마누칸 섬 관광지 사진" }).textContent).toContain(
      "관광지 · 마누칸 섬",
    );
  });
});
