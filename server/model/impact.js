export function computeImpactRadii({ diameterM, speedKms, angleDeg, type = "ground" }) {
    const rho = 3000;
    const v = speedKms * 1000;
    const m = (Math.PI / 6) * Math.pow(diameterM, 3) * rho;
    const E = 0.5 * m * v * v;
    const Mt = E / 4.184e15;

    const angle = Math.max(0.3, Math.sin((angleDeg * Math.PI) / 180));
    const k = type === "airburst" ? 1.2 : type === "water" ? 0.9 : 1.0;

    const severeKm = Math.cbrt(Mt) * 6.0 * angle * k;
    const majorKm = severeKm * 1.8;
    const lightKm = severeKm * 3.2;

    return {
        severeKm: +severeKm.toFixed(1),
        majorKm: +majorKm.toFixed(1),
        lightKm: +lightKm.toFixed(1),
        energyMt: +Mt.toFixed(2)
    };
}
