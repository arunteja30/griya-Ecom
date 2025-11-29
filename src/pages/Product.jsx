import React from "react";
import { useParams } from "react-router-dom";
import { useRealtime, useSiteSettings } from "../hooks/useRealtime";

export default function Product() {
  const { id } = useParams();
  const { data: product, loading } = useRealtime(`/products/${id}`);
  const { data: settings } = useSiteSettings();
  const theme = settings?.theme || {};

  if (loading) return <div>Loading...</div>;
  if (!product) return <div>Product not found</div>;

  const titleStyle = { color: theme.titleColor || theme.primaryColor || undefined };
  const priceStyle = { color: theme.accentColor || theme.primaryColor || undefined };
  const descStyle = { color: theme.cardTextColor || undefined };
  const imgStyle = { border: theme.cardBorderColor ? `1px solid ${theme.cardBorderColor}` : undefined };
  const btnBg = theme.cardButtonPrimaryBg || theme.primaryColor || '#111';
  const btnStyle = { background: btnBg, color: theme.cardButtonPrimaryTextColor || '#fff' };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <img
          src={product.image || '/placeholder.jpg'}
          alt={product.title}
          className="w-full h-96 object-cover rounded"
          style={imgStyle}
        />
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2" style={titleStyle}>{product.title}</h1>
        <div className="text-xl mb-4" style={priceStyle}>₹{product.price}</div>
        <div className="prose mb-4" style={descStyle}>{product.description}</div>
        <button className="px-4 py-2 rounded" style={btnStyle}>Add to cart</button>
      </div>
    </div>
  );
}
