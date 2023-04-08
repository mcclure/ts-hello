// From https://alain.xyz/blog/raw-webgpu , unrestricted license

@fragment
fn main(@location(0) in_color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(in_color, 1.0);
}