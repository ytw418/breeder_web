import { Product } from "@prisma/client";
import ProductCard from "./ProductCard";

interface ProductListProps {
  products: (Product & {
    _count: {
      favs: number;
    };
  })[];
}

const ProductList = ({ products }: ProductListProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          title={product.name}
          price={product.price}
          image={product.photos[0]}
        />
      ))}
    </div>
  );
};

export default ProductList;
