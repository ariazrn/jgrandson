import { useState } from "react";
export function Header({ title }: { title: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleOnClick = () => {
    setMenuOpen((!menuOpen));
  };

  return (
    <div>
    <header style={{ padding: "24px" }}>
      <span>
        {title}
      </span>
      <button onClick={handleOnClick}>
        {"Menu"}
      </button>
    {menuOpen ? (
      <list>
      {["Home", "About", "Contact"].map((item, index) => (
        <div key={index}>
        <span>
          {item}
        </span>
        </div>
      ))}
      </list>
    ) : (
      null
    )}
    </header>
    </div>
  );
}
