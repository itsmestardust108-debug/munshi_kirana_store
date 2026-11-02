/**
 * Online & Offline Barcode Catalog Lookup Engine
 * Automatically fetches product name, brand, and pack size for commercial barcodes
 */

export interface BarcodeProductInfo {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;
  unit?: string;
  typicalPrice?: number;
  source: 'open-catalog' | 'curated-offline';
}

// Top curated common Indian Kirana barcodes (available 100% offline)
const COMMON_INDIAN_BARCODES: Record<string, { name: string; brand: string; unit: string; typicalPrice?: number }> = {
  '8901058852231': { name: 'Maggi 2-Minute Masala Noodles (70g)', brand: 'Nestle', unit: 'pack', typicalPrice: 14 },
  '8901058017687': { name: 'Maggi 2-Minute Masala Noodles (75g)', brand: 'Nestle', unit: 'pack', typicalPrice: 14 },
  '8901030383821': { name: 'Tata Salt Vacuum Evaporated (1kg)', brand: 'Tata', unit: 'pack', typicalPrice: 28 },
  '8901719114757': { name: 'Parle-G Original Glucose Biscuits (250g)', brand: 'Parle', unit: 'pack', typicalPrice: 25 },
  '8901719114740': { name: 'Parle-G Glucose Biscuits (80g)', brand: 'Parle', unit: 'pack', typicalPrice: 10 },
  '8901063012620': { name: 'Britannia Good Day Butter Cookies (100g)', brand: 'Britannia', unit: 'pack', typicalPrice: 20 },
  '8901063011401': { name: 'Britannia Marie Gold Biscuits (120g)', brand: 'Britannia', unit: 'pack', typicalPrice: 15 },
  '8901030005396': { name: 'Lifebuoy Total Soap Bar (125g)', brand: 'Lifebuoy', unit: 'pc', typicalPrice: 35 },
  '8901030013582': { name: 'Surf Excel Easy Wash Detergent Powder (1kg)', brand: 'Surf Excel', unit: 'pack', typicalPrice: 140 },
  '8901030013575': { name: 'Surf Excel Quick Wash (500g)', brand: 'Surf Excel', unit: 'pack', typicalPrice: 75 },
  '8901030048102': { name: 'Rin Detergent Bar (250g)', brand: 'Rin', unit: 'pc', typicalPrice: 20 },
  '8901030005822': { name: 'Vim Dishwash Bar (300g)', brand: 'Vim', unit: 'pc', typicalPrice: 25 },
  '8901030005815': { name: 'Vim Dishwash Bar (150g)', brand: 'Vim', unit: 'pc', typicalPrice: 15 },
  '8901314010528': { name: 'Colgate Strong Teeth Toothpaste (100g)', brand: 'Colgate', unit: 'pack', typicalPrice: 65 },
  '8901314010535': { name: 'Colgate MaxFresh Blue Gel (150g)', brand: 'Colgate', unit: 'pack', typicalPrice: 110 },
  '8901491101835': { name: "Lay's India's Magic Masala Chips (50g)", brand: "Lay's", unit: 'pack', typicalPrice: 20 },
  '8901491001012': { name: 'Kurkure Masala Munch (90g)', brand: 'Kurkure', unit: 'pack', typicalPrice: 20 },
  '8901262010045': { name: 'Amul Butter Salted (100g)', brand: 'Amul', unit: 'pack', typicalPrice: 58 },
  '8901262010052': { name: 'Amul Butter Salted (500g)', brand: 'Amul', unit: 'pack', typicalPrice: 285 },
  '8901207010482': { name: 'Fortune Sunlite Refined Sunflower Oil (1L)', brand: 'Fortune', unit: 'l', typicalPrice: 145 },
  '8901725181224': { name: 'Aashirvaad Superior MP Sharbati Atta (5kg)', brand: 'Aashirvaad', unit: 'pack', typicalPrice: 275 },
  '8901725181217': { name: 'Aashirvaad Whole Wheat Atta (10kg)', brand: 'Aashirvaad', unit: 'pack', typicalPrice: 460 },
  '8901248100111': { name: 'Dettol Original Bathing Soap (75g)', brand: 'Dettol', unit: 'pc', typicalPrice: 38 },
  '8901248100128': { name: 'Dettol Antiseptic Liquid (100ml)', brand: 'Dettol', unit: 'pack', typicalPrice: 42 },
};

/**
 * Looks up product details by barcode:
 * 1. First checks curated instant offline Indian catalog
 * 2. If not found and online, queries Open Food Facts API (100% free, public community database)
 */
export async function lookupBarcodeProduct(barcode: string): Promise<BarcodeProductInfo | null> {
  const cleanCode = barcode.trim();
  if (!cleanCode) return null;

  // 1. Instant Curated Offline Check
  if (COMMON_INDIAN_BARCODES[cleanCode]) {
    const item = COMMON_INDIAN_BARCODES[cleanCode];
    return {
      barcode: cleanCode,
      name: item.name,
      brand: item.brand,
      unit: item.unit,
      typicalPrice: item.typicalPrice,
      source: 'curated-offline',
    };
  }

  // 2. Online Open Food Facts API (with 2.5s timeout)
  if (typeof fetch === 'function' && typeof navigator !== 'undefined' && navigator.onLine !== false) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${cleanCode}.json`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MunsiKiranaStore/1.0 (Kirana Shop Barcode Assistant)',
        },
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 1 && data.product) {
          const p = data.product;
          let name = p.product_name_hi || p.product_name || p.product_name_en || '';
          const brand = p.brands || '';
          const quantity = p.quantity || '';

          if (name) {
            // Prepend brand if not already in name
            if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
              name = `${brand} ${name}`;
            }
            // Append quantity if available and not already in name
            if (quantity && !name.includes(quantity)) {
              name = `${name} (${quantity})`;
            }

            return {
              barcode: cleanCode,
              name: name.trim(),
              brand,
              quantity,
              unit: 'pack',
              source: 'open-catalog',
            };
          }
        }
      }
    } catch {
      // Gracefully ignore network timeout or offline
    }
  }

  return null;
}
