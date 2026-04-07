import { NextResponse } from "next/server";
import {
  formToPreviewProduct,
  productToCardPropsPayload,
  productToDetailV2PropsPayload,
  type ProductFormPayload,
} from "@/lib/admin/productPreview";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";

type PreviewRequestBody = {
  form: ProductFormPayload;
  imageUrl?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewRequestBody;
    const form = body.form;
    const imageUrl = body.imageUrl ?? form?.image_url?.trim() ?? "";

    if (!form || typeof form !== "object") {
      return NextResponse.json(
        { message: "form 객체가 필요합니다." },
        { status: 400 },
      );
    }

    const campaignTaxonomies = await getCampaignTaxonomiesForCard();
    const previewProduct = hydrateProductWithCampaignCardMeta(
      formToPreviewProduct(form, imageUrl),
      campaignTaxonomies,
    );
    const resolvedNotices = await resolveProductNoticesForDetailPage(previewProduct);
    const cardProps = productToCardPropsPayload(previewProduct);
    const detailProps = productToDetailV2PropsPayload(
      previewProduct,
      null,
      null,
      resolvedNotices,
    );

    return NextResponse.json({
      previewProduct,
      cardProps,
      detailProps,
    });
  } catch (error) {
    console.error("[api/admin/products/preview]", error);
    return NextResponse.json(
      { message: "미리보기 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
