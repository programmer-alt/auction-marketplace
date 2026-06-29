export default function Contacts() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Контакты</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Свяжитесь с нами</h2>
          <p className="mb-4">
            Мы всегда рады помочь вам с любыми вопросами, касающимися работы платформы,
            проведения аукционов или технической поддержки.
          </p>
          <ul className="space-y-3">
            <li className="flex items-center">
              <span className="font-medium w-32">Электронная почта:</span>
              <span>support@auction-marketplace.example</span>
            </li>
            <li className="flex items-center">
              <span className="font-medium w-32">Телефон:</span>
              <span>+7 (999) 123-45-67</span>
            </li>
            <li className="flex items-center">
              <span className="font-medium w-32">Адрес офиса:</span>
              <span>г. Москва, ул. Примерная, д. 1</span>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4">Форма обратной связи</h2>
          <form className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Ваше имя
              </label>
              <input
                type="text"
                id="name"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Электронная почта
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="example@mail.com"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-1">
                Сообщение
              </label>
              <textarea
                id="message"
                rows={4}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Опишите ваш вопрос или предложение..."
              />
            </div>
            <button
              type="submit"
              className="btn-primary px-6 py-2 rounded-lg font-medium"
            >
              Отправить
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
