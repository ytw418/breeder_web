import { capturePosthogEvent } from "@libs/client/posthog";

export const ANALYTICS_EVENTS = {
  homeBannerClicked: "home_banner_clicked",
  homeCategorySelected: "home_category_selected",
  homePopularProductClicked: "home_popular_product_clicked",
  homeOngoingAuctionClicked: "home_ongoing_auction_clicked",
  homePostLoginInstallClicked: "home_post_login_install_clicked",
  homePostLoginInstallCompleted: "home_post_login_install_completed",
  homePostLoginPushSettingsClicked: "home_post_login_push_settings_clicked",
  homePostLoginGuideDismissed: "home_post_login_guide_dismissed",
  homeProductUploadClicked: "home_product_upload_clicked",
  productDetailViewed: "product_detail_viewed",
  productFavoriteClicked: "product_favorite_clicked",
  productFavoriteFailed: "product_favorite_failed",
  productChatClicked: "product_chat_clicked",
  productChatRoomCreated: "product_chat_room_created",
  productChatRoomCreateFailed: "product_chat_room_create_failed",
  productStatusChanged: "product_status_changed",
  productMarkedSold: "product_marked_sold",
  productPurchaseConfirmed: "product_purchase_confirmed",
  productDeleted: "product_deleted",
  auctionDetailViewed: "auction_detail_viewed",
  auctionBidAmountAdjusted: "auction_bid_amount_adjusted",
  auctionBidAttempted: "auction_bid_attempted",
  auctionBidSubmitted: "auction_bid_submitted",
  auctionBidFailed: "auction_bid_failed",
  auctionLinkCopied: "auction_link_copied",
  auctionShared: "auction_shared",
  auctionReportSubmitted: "auction_report_submitted",
  auctionReportFailed: "auction_report_failed",
  sentryExampleClientErrorClicked: "sentry_example_client_error_clicked",
  sentryExampleApiErrorClicked: "sentry_example_api_error_clicked",
  sentryExampleApiErrorReceived: "sentry_example_api_error_received",
} as const;

type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type AnalyticsProperties = Record<string, unknown>;

export const trackEvent = (
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {}
) => {
  return capturePosthogEvent(eventName, {
    app_area: "web",
    ...properties,
  });
};
