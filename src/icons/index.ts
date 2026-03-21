import { BaggageIcon } from "@/icons/system/BaggageIcon";
import { CalendarIcon } from "@/icons/system/CalendarIcon";
import { CameraIcon } from "@/icons/system/CameraIcon";
import { CheckIcon } from "@/icons/system/CheckIcon";
import { ChevronRightIcon } from "@/icons/system/ChevronRightIcon";
import { ClockIcon } from "@/icons/system/ClockIcon";
import { CloseIcon } from "@/icons/system/CloseIcon";
import { CompassIcon } from "@/icons/system/CompassIcon";
import { ExploreIcon } from "@/icons/system/ExploreIcon";
import { FamilyTravelIcon } from "@/icons/system/FamilyTravelIcon";
import { FlagIcon } from "@/icons/system/FlagIcon";
import { FlightIcon } from "@/icons/system/FlightIcon";
import { GolfTravelIcon } from "@/icons/system/GolfTravelIcon";
import { HotelIcon } from "@/icons/system/HotelIcon";
import { ImageIcon } from "@/icons/system/ImageIcon";
import { ImageMediaIcon } from "@/icons/system/ImageMediaIcon";
import { IncludedItemsIcon } from "@/icons/system/IncludedItemsIcon";
import { LandmarkIcon } from "@/icons/system/LandmarkIcon";
import { LuxuryTravelIcon } from "@/icons/system/LuxuryTravelIcon";
import { MoreHorizontalIcon } from "@/icons/system/MoreHorizontalIcon";
import { PlaneLandingIcon } from "@/icons/system/PlaneLandingIcon";
import { PriceIcon } from "@/icons/system/PriceIcon";
import { RegionPinIcon } from "@/icons/system/RegionPinIcon";
import { RelaxationHealingIcon } from "@/icons/system/RelaxationHealingIcon";
import { SearchIcon } from "@/icons/system/SearchIcon";
import { SparklesIcon } from "@/icons/system/SparklesIcon";
import { UtensilsIcon } from "@/icons/system/UtensilsIcon";
import { UsersIcon } from "@/icons/system/UsersIcon";
import { XCircleIcon } from "@/icons/system/XCircleIcon";

/**
 * 브랜드 아이콘 레지스트리 (1차).
 * - 키는 도메인 용어 기준 (파일명과 1:1은 아님)
 */
export const ICONS = {
  golf: GolfTravelIcon,
  healing: RelaxationHealingIcon,
  family: FamilyTravelIcon,
  luxury: LuxuryTravelIcon,
  explore: ExploreIcon,
  flight: FlightIcon,
  hotel: HotelIcon,
  included: IncludedItemsIcon,
  region: RegionPinIcon,
  calendar: CalendarIcon,
  baggage: BaggageIcon,
  price: PriceIcon,
  search: SearchIcon,
  chevronRight: ChevronRightIcon,
  image: ImageIcon,
  /** @deprecated `image`와 동일 구현 — 하위 호환 */
  imageMedia: ImageMediaIcon,
  close: CloseIcon,
  sparkles: SparklesIcon,
  camera: CameraIcon,
  users: UsersIcon,
  compass: CompassIcon,
  moreHorizontal: MoreHorizontalIcon,
  planeLanding: PlaneLandingIcon,
  utensils: UtensilsIcon,
  landmark: LandmarkIcon,
  flag: FlagIcon,
  clock: ClockIcon,
  check: CheckIcon,
  xCircle: XCircleIcon,
} as const;

export type IconName = keyof typeof ICONS;

export type { SystemIconProps } from "@/icons/system/iconTypes";
export { SYSTEM_ICON_STROKE } from "@/icons/system/iconTypes";

export {
  GolfTravelIcon,
  RelaxationHealingIcon,
  FamilyTravelIcon,
  LuxuryTravelIcon,
  ExploreIcon,
  FlightIcon,
  HotelIcon,
  IncludedItemsIcon,
  RegionPinIcon,
  CalendarIcon,
  BaggageIcon,
  PriceIcon,
  SearchIcon,
  ChevronRightIcon,
  ImageMediaIcon,
  CloseIcon,
  SparklesIcon,
  CameraIcon,
  ImageIcon,
  UsersIcon,
  CompassIcon,
  MoreHorizontalIcon,
  PlaneLandingIcon,
  UtensilsIcon,
  LandmarkIcon,
  FlagIcon,
  ClockIcon,
  CheckIcon,
  XCircleIcon,
};
