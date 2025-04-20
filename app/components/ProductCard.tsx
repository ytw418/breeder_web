import Image from "next/image";
import Link from "next/link";

interface ProductCardProps {
  id: number;
  title: string;
  price: number;
  image: string;
}

const ProductCard = ({ id, title, price, image }: ProductCardProps) => {
  return (
    <Link href={`/products/${id}`}>
      <div className="flex flex-col space-y-2 cursor-pointer">
        <div className="relative aspect-square rounded-lg overflow-hidden">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-transform hover:scale-105"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 truncate">
            {title}
          </span>
          <span className="text-sm font-semibold text-primary">
            {price.toLocaleString()}원
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
