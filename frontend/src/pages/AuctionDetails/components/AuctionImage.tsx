import React from "react";

interface AuctionImageProps {
  imageUrl: string | null;
  title: string;
}

const AuctionImage: React.FC<AuctionImageProps> = ({ imageUrl, title }) => {
  if (!imageUrl) {
    return null;
  }

  return <img src={imageUrl} alt={title} className="w-full h-64 object-cover rounded-lg mb-4" />;
};

export default React.memo(AuctionImage);
