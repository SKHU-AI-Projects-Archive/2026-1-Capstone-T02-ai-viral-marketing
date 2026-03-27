type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionTitle({ eyebrow, title, description }: SectionTitleProps) {
  return (
    <header className="hero">
      <p className="hero__eyebrow">{eyebrow}</p>
      <h1 className="hero__title">{title}</h1>
      <p className="hero__description">{description}</p>
    </header>
  );
}
