export default function Home() {
  return (
    <div className="p-6 max-w-screen-sm mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Start a Visit</h1>
      <VisitStartInline />
    </div>
  );
}

function VisitStartInline() {
  return (
    <form action="/visit/new">
      <button className="w-full h-12 bg-black text-white rounded">Open Visit Form</button>
    </form>
  );
}



