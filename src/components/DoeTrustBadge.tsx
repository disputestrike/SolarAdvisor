import Image from "next/image";

export default function DoeTrustBadge() {
  return (
    <a
      href="https://www.energy.gov/eere/solar"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        textDecoration: "none",
      }}
    >
      <Image
        src="/sunshot-powered.png"
        alt="Powered by SunShot, U.S. Department of Energy"
        width={280}
        height={111}
        priority
        style={{ width: "176px", height: "auto", display: "block" }}
      />
    </a>
  );
}
