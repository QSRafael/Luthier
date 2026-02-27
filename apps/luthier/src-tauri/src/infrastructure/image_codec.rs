use std::io::Cursor;

use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageFormat, RgbaImage};

use crate::application::ports::{ImageCodecPort, RasterImage, RasterImageFormat, ResizeFilter};
use crate::error::{BackendError, BackendResult};

#[derive(Debug, Clone, Copy, Default)]
pub struct ImageRsCodec;

impl ImageRsCodec {
    pub fn new() -> Self {
        Self
    }
}

impl ImageCodecPort for ImageRsCodec {
    fn decode(&self, bytes: &[u8]) -> BackendResult<RasterImage> {
        let image = image::load_from_memory(bytes)?;
        Ok(dynamic_image_to_raster(image))
    }

    fn decode_with_format(
        &self,
        bytes: &[u8],
        format: RasterImageFormat,
    ) -> BackendResult<RasterImage> {
        let image = image::load_from_memory_with_format(bytes, to_image_format(format))?;
        Ok(dynamic_image_to_raster(image))
    }

    fn encode(&self, image: &RasterImage, format: RasterImageFormat) -> BackendResult<Vec<u8>> {
        let dynamic = raster_to_dynamic_image(image)?;
        encode_dynamic_image_to_bytes(&dynamic, to_image_format(format)).map_err(BackendError::from)
    }

    fn crop_imm(
        &self,
        image: &RasterImage,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> BackendResult<RasterImage> {
        let dynamic = raster_to_dynamic_image(image)?;
        Ok(dynamic_image_to_raster(
            dynamic.crop_imm(x, y, width, height),
        ))
    }

    fn resize_exact(
        &self,
        image: &RasterImage,
        width: u32,
        height: u32,
        filter: ResizeFilter,
    ) -> BackendResult<RasterImage> {
        let dynamic = raster_to_dynamic_image(image)?;
        Ok(dynamic_image_to_raster(dynamic.resize_exact(
            width,
            height,
            to_filter_type(filter),
        )))
    }

    fn thumbnail(
        &self,
        image: &RasterImage,
        max_width: u32,
        max_height: u32,
    ) -> BackendResult<RasterImage> {
        let dynamic = raster_to_dynamic_image(image)?;
        Ok(dynamic_image_to_raster(
            dynamic.thumbnail(max_width, max_height),
        ))
    }
}

pub(crate) fn extract_best_png_from_ico_groups(
    icon_groups: Vec<Vec<u8>>,
) -> Result<(Vec<u8>, u32, u32), String> {
    if icon_groups.is_empty() {
        return Err("no icon resources found in executable".to_string());
    }

    let mut best_image: Option<DynamicImage> = None;
    let mut best_area = 0u64;

    for icon_bytes in icon_groups {
        let decoded = match image::load_from_memory_with_format(&icon_bytes, ImageFormat::Ico) {
            Ok(image) => image,
            Err(_) => continue,
        };

        let (width, height) = decoded.dimensions();
        let area = u64::from(width) * u64::from(height);
        if area > best_area {
            best_area = area;
            best_image = Some(decoded);
        }
    }

    let Some(mut image) = best_image else {
        return Err("failed to decode icon resources to image".to_string());
    };

    if image.width() > 256 || image.height() > 256 {
        image = image.thumbnail(256, 256);
    }

    let (width, height) = image.dimensions();
    let png_bytes = encode_dynamic_image_to_bytes(&image, ImageFormat::Png)
        .map_err(|err| format!("failed to encode PNG icon: {err}"))?;

    Ok((png_bytes, width, height))
}

pub(crate) fn crop_to_ratio_and_resize(
    image: DynamicImage,
    ratio_w: u32,
    ratio_h: u32,
    target_w: u32,
    target_h: u32,
) -> Result<DynamicImage, String> {
    let (src_w, src_h) = image.dimensions();
    if src_w == 0 || src_h == 0 {
        return Err("hero image has invalid dimensions".to_string());
    }

    let lhs = u64::from(src_w) * u64::from(ratio_h);
    let rhs = u64::from(src_h) * u64::from(ratio_w);

    let (crop_x, crop_y, crop_w, crop_h) = if lhs > rhs {
        let crop_w = ((u64::from(src_h) * u64::from(ratio_w)) / u64::from(ratio_h))
            .clamp(1, u64::from(src_w)) as u32;
        let crop_x = (src_w.saturating_sub(crop_w)) / 2;
        (crop_x, 0, crop_w, src_h)
    } else {
        let crop_h = ((u64::from(src_w) * u64::from(ratio_h)) / u64::from(ratio_w))
            .clamp(1, u64::from(src_h)) as u32;
        let crop_y = (src_h.saturating_sub(crop_h)) / 2;
        (0, crop_y, src_w, crop_h)
    };

    let cropped = image.crop_imm(crop_x, crop_y, crop_w, crop_h);
    Ok(cropped.resize_exact(target_w, target_h, FilterType::Lanczos3))
}

pub(crate) fn encode_dynamic_image_to_bytes(
    image: &DynamicImage,
    format: ImageFormat,
) -> image::ImageResult<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::<u8>::new());
    image.write_to(&mut cursor, format)?;
    Ok(cursor.into_inner())
}

fn dynamic_image_to_raster(image: DynamicImage) -> RasterImage {
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    RasterImage {
        width,
        height,
        rgba8: rgba.into_raw(),
    }
}

fn raster_to_dynamic_image(image: &RasterImage) -> BackendResult<DynamicImage> {
    let expected_len = expected_rgba_len(image.width, image.height)?;
    if image.rgba8.len() != expected_len {
        return Err(BackendError::invalid_input(format!(
            "invalid RGBA buffer length: expected {expected_len} bytes for {}x{}, got {}",
            image.width,
            image.height,
            image.rgba8.len()
        ))
        .with_code("invalid_raster_rgba_length"));
    }

    let rgba =
        RgbaImage::from_vec(image.width, image.height, image.rgba8.clone()).ok_or_else(|| {
            BackendError::invalid_input("failed to build RGBA image from buffer")
                .with_code("invalid_raster_rgba_buffer")
        })?;

    Ok(DynamicImage::ImageRgba8(rgba))
}

fn expected_rgba_len(width: u32, height: u32) -> BackendResult<usize> {
    let pixels = usize::try_from(width)
        .ok()
        .and_then(|w| usize::try_from(height).ok().and_then(|h| w.checked_mul(h)))
        .ok_or_else(|| {
            BackendError::invalid_input(format!("image dimensions are too large: {width}x{height}"))
                .with_code("image_dimensions_too_large")
        })?;
    pixels.checked_mul(4).ok_or_else(|| {
        BackendError::invalid_input(format!(
            "image byte size overflow for dimensions: {width}x{height}"
        ))
        .with_code("image_byte_size_overflow")
    })
}

fn to_image_format(format: RasterImageFormat) -> ImageFormat {
    match format {
        RasterImageFormat::Png => ImageFormat::Png,
        RasterImageFormat::WebP => ImageFormat::WebP,
        RasterImageFormat::Ico => ImageFormat::Ico,
        RasterImageFormat::Jpeg => ImageFormat::Jpeg,
        RasterImageFormat::Gif => ImageFormat::Gif,
    }
}

fn to_filter_type(filter: ResizeFilter) -> FilterType {
    match filter {
        ResizeFilter::Lanczos3 => FilterType::Lanczos3,
        ResizeFilter::Triangle => FilterType::Triangle,
        ResizeFilter::Nearest => FilterType::Nearest,
    }
}
