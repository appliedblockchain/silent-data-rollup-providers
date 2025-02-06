export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} Counter App. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a href="/terms" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Terms of Service
            </a>
            <a href="/contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
} 