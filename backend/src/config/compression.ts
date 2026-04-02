import compression from "compression";

const COMPRESSION_EXCLUDED_PATHS = ["/api/payments/webhook"];

export const compressionOptions: compression.CompressionOptions = {
  threshold: 1024,
  filter: (req, res) => {
    if (COMPRESSION_EXCLUDED_PATHS.includes(req.path)) return false;
    return compression.filter(req, res);
  },
};
