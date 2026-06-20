import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const catalogPath = "src/lib/products-catalog.ts";
const imagesMapPath = "src/lib/product-images.json";

const catalog = readFileSync(catalogPath, "utf8");
const imageMap = JSON.parse(readFileSync(imagesMapPath, "utf8"));

const productRe = /\{ title: "([^"]+)", url: "([^"]+)", slug: "([^"]+)" \}/g;
const products = [];
let match;
while ((match = productRe.exec(catalog))) {
  products.push({ title: match[1], url: match[2], slug: match[3] });
}

const missingImageMappings = products.filter((product) => !imageMap[product.slug]);
const brokenImageFiles = Object.entries(imageMap)
  .filter(([, imagePath]) => !existsSync(join("public", imagePath.replace(/^\//, ""))))
  .map(([slug, imagePath]) => ({ slug, imagePath }));
const extraImageMappings = Object.keys(imageMap).filter(
  (slug) => !products.some((product) => product.slug === slug),
);
const suspiciousProducts = products.filter((product) =>
  /\btmp\b|placeholder|dummy|lorem|test-product/i.test(
    `${product.title} ${product.slug} ${product.url}`,
  ),
);

const legalFiles = [
  { name: "privacy", path: "src/app/privacy/page.tsx" },
  { name: "terms", path: "src/app/terms/page.tsx" },
];
const legalTemplateWarnings = legalFiles.filter(({ path }) => {
  const text = readFileSync(path, "utf8");
  return /general template|متن نمونه|نمونه و عمومی|legal advisor|مشاور حقوقی/i.test(text);
});

const result = {
  success:
    brokenImageFiles.length === 0 &&
    extraImageMappings.length === 0,
  products: products.length,
  imageMappings: Object.keys(imageMap).length,
  warnings: {
    missingImageMappings: missingImageMappings.length,
    suspiciousProducts: suspiciousProducts.length,
    legalTemplateWarnings: legalTemplateWarnings.length,
  },
  missingImageMappings,
  brokenImageFiles,
  extraImageMappings,
  suspiciousProducts,
  legalTemplateWarnings,
};

console.log(JSON.stringify(result, null, 2));

if (!result.success) {
  process.exit(1);
}
